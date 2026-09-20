import { act, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import HeatmapView from "./HeatmapView";
import type { MapCanvasProps } from "./MapCanvas";
import { useTelemetryStream, type TelemetryData } from "@/lib/useTelemetryStream";

jest.mock("next/navigation", () => ({
    useSearchParams: jest.fn(),
}));

jest.mock("@/lib/useTelemetryStream", () => ({
    useTelemetryStream: jest.fn(),
}));

jest.mock("./MapCanvas", () => ({
    __esModule: true,
    default: (props: MapCanvasProps) => {
        const first = props.collection.features[0]?.properties.buildingId ?? null;
        return (
            <div data-testid="map">
                <span>{`${props.collection.features.length} on map, selected ${props.selectedId ?? "none"}, placing ${String(props.placing)}`}</span>
                <span data-testid="map-values">{props.collection.features.map((feature) => `${feature.properties.buildingId}=${feature.properties.value}`).join(" ")}</span>
                <button type="button" onClick={() => props.onSelect(first)}>Map pick</button>
                <button type="button" onClick={() => props.onPlace({ longitude: 28.23111149, latitude: -25.75555549 })}>Map place</button>
                <button type="button" onClick={() => first && props.onHover({ buildingId: first, x: 20, y: 30 })}>Map hover</button>
                <button type="button" onClick={() => props.onFailure("This browser cannot draw the map.")}>Map fail</button>
            </div>
        );
    },
}));

const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockUseTelemetryStream = useTelemetryStream as jest.MockedFunction<typeof useTelemetryStream>;

const BUILDINGS = [
    { building_id: "b1", building_name: "Hatfield Park", building_type: "Commercial", latitude: -25.75, longitude: 28.23, square_footage: 4000 },
    { building_id: "b2", building_name: "Brooklyn Clinic", building_type: "Healthcare", latitude: -25.77, longitude: 28.24, square_footage: 500 },
    { building_id: "b3", building_name: "Rosslyn Depot", building_type: "Industrial", latitude: null, longitude: null, square_footage: 9000 }
];

type Snapshot = Record<string, number | null>;

type ApiOptions = {
    buildings?: typeof BUILDINGS;
    heatmap?: Record<string, Snapshot> | null;
    live?: Array<{ building_id: string; current_kw: number }>;
    patchStatus?: number;
};

let patchBodies: unknown[];

function respond(status: number, body: unknown) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function mockApi({ buildings = BUILDINGS, heatmap = { live: { b1: 42, b2: 13 } }, live = [], patchStatus = 200 }: ApiOptions = {}) {
    patchBodies = [];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/buildings") {
            return respond(200, { data: buildings });
        }
        if (url.startsWith("/api/heatmap")) {
            const timeframe = decodeURIComponent(url.split("timeframe=")[1] ?? "");
            const values = heatmap?.[timeframe];
            if (!heatmap || !values) {
                return respond(404, { message: "Not found" });
            }
            return respond(200, { data: { points: Object.entries(values).map(([building_id, value]) => ({ building_id, value })) } });
        }
        if (url === "/api/telemetry/live") {
            return respond(200, { status: "success", data: live });
        }
        if (url.startsWith("/api/buildings/") && init?.method === "PATCH") {
            patchBodies.push(JSON.parse(String(init.body)));
            return patchStatus === 200 ? respond(200, { status: "success" }) : respond(patchStatus, { message: "You do not have permission to edit the building" });
        }
        return respond(404, {});
    }) as unknown as typeof fetch;
}

function renderView(role = "BUILDING_MANAGER") {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = () => (<QueryClientProvider client={client}><HeatmapView role={role} /></QueryClientProvider>);
    const result = render(view());
    return { ...result, refresh: () => result.rerender(view()) };
}

const ranking = () => screen.getByRole("complementary", { name: "Buildings ranked for the selected period" });
const row = (name: string) => within(ranking()).getByRole("button", { name: new RegExp(`^${name}`) });

let streamState: { liveData: TelemetryData | null; isConnected: boolean };

beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as never);
    streamState = { liveData: null, isConnected: false };
    mockUseTelemetryStream.mockImplementation(() => ({ ...streamState, error: null }));
});

describe("HeatmapView", () => {
    it("ranks every placed building by live load", async () => {
        mockApi();
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));
        expect(row("Brooklyn Clinic")).toHaveTextContent("13.0 kW");
        expect(within(ranking()).getAllByRole("button", { name: /Park|Clinic/ })[0]).toHaveTextContent("Hatfield Park");
        expect(screen.getByText("2 on map, selected none, placing false")).toBeInTheDocument();
        const summary = screen.getByRole("group", { name: "Portfolio summary for the selected period" });
        expect(summary).toHaveTextContent("Portfolio55.0 kW");
        expect(summary).toHaveTextContent("On the map2 of 3");
        expect(summary).toHaveTextContent("HottestHatfield Park");
        expect(screen.getByText("Current draw in kW")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Hotspots" })).toBeInTheDocument();
    });

    it("checks the forecast and compares with the last 7 days", async () => {
        const user = userEvent.setup();
        mockApi({ heatmap: { live: { b1: 42, b2: 13 }, "-7d": { b1: 800, b2: 300 }, "+30d": { b1: 1000, b2: 240 } } });
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));

        await user.click(screen.getByRole("button", { name: "In 30 days" }));

        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("1,000 kWh/day"));
        expect(screen.getByRole("heading", { name: "Predicted hotspots" })).toBeInTheDocument();
        expect(screen.getByText("Predicted daily use in kWh")).toBeInTheDocument();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("Up 25% on the last 7 days"));
        expect(row("Brooklyn Clinic")).toHaveTextContent("Down 20% on the last 7 days");
        expect(screen.getByTestId("map-values")).toHaveTextContent("b1=1000 b2=240");
    });

    it("falls back to the live telemetry feed when the heatmap endpoint is missing", async () => {
        mockApi({ heatmap: null, live: [{ building_id: "b2", current_kw: 27.5 }] });
        renderView();

        await waitFor(() => expect(row("Brooklyn Clinic")).toHaveTextContent("27.5 kW"));
        expect(row("Hatfield Park")).toHaveTextContent("No data");
        expect(screen.getByText("1 building has no data for this period.")).toBeInTheDocument();
    });

    it("opens a building card that links into the 3D twin", async () => {
        const user = userEvent.setup();
        mockApi();
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));

        await user.click(row("Brooklyn Clinic"));

        const card = screen.getByRole("region", { name: "Brooklyn Clinic on the heatmap" });
        expect(within(card).getByRole("link", { name: "Open 3D twin" })).toHaveAttribute("href", "/buildings/b2/view#digital-twin");
        expect(within(card).getByRole("link", { name: "Building details" })).toHaveAttribute("href", "/buildings/b2/view");
        expect(card).toHaveTextContent("Rank2 of 2");
        expect(card).toHaveTextContent("Portfolio share24%");
        expect(card).toHaveTextContent("0.026 per m²");
        expect(screen.getByText(/selected b2/)).toBeInTheDocument();

        await user.click(within(card).getByRole("button", { name: "Close building details" }));
        expect(screen.queryByRole("region", { name: "Brooklyn Clinic on the heatmap" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Map pick" }));
        expect(screen.getByRole("region", { name: "Hatfield Park on the heatmap" })).toBeInTheDocument();
    });

    it("indicates how fresh a forecast is", async () => {
        const user = userEvent.setup();
        mockApi();
        global.fetch = jest.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url === "/api/buildings") {
                return respond(200, { data: BUILDINGS });
            }
            if (url.startsWith("/api/heatmap")) {
                return respond(200, { data: { points: [{ building_id: "b1", value: 900, model_updated_at: "2026-07-29T18:04:59Z" }, { building_id: "b2", value: 200 }] } });
            }
            return respond(404, {});
        }) as unknown as typeof fetch;
        mockUseSearchParams.mockReturnValue(new URLSearchParams("timeframe=%2B30d&building=b1") as never);
        renderView();

        const card = await screen.findByRole("region", { name: "Hatfield Park on the heatmap" });
        await waitFor(() => expect(card).toHaveTextContent("Model updatedJul 29, 2026"));
        await user.click(within(card).getByRole("button", { name: "Close building details" }));
    });

    it("shows a tooltip for the building under the pointer", async () => {
        const user = userEvent.setup();
        mockApi();
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));

        await user.click(screen.getByRole("button", { name: "Map hover" }));

        expect(document.querySelector(".heat-tooltip")).toHaveTextContent("Hatfield Park42.0 kW");
    });

    
    it("compares buildings accurately per square metre", async () => {
        const user = userEvent.setup();
        mockApi();
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));

        await user.click(screen.getByRole("radio", { name: "Per m²" }));

        expect(screen.getByRole("radio", { name: "Per m²" })).toHaveAttribute("aria-checked", "true");
        const names = within(ranking()).getAllByRole("button", { name: /Park|Clinic/ }).map((item) => item.textContent);
        expect(names[0]).toContain("Brooklyn Clinic");
        expect(row("Brooklyn Clinic")).toHaveTextContent("0.026 per m²");
        expect(screen.getByText("Current draw per m²")).toBeInTheDocument();
    });

    it("lets a manager place a building by clicking on the map", async () => {
        const user = userEvent.setup();
        mockApi();
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));

        const unplaced = screen.getByRole("heading", { name: "Not on the map (1)" }).parentElement as HTMLElement;
        await user.click(within(unplaced).getByRole("button", { name: "Place" }));

        expect(screen.getByText("Click the map where Rosslyn Depot stands.")).toBeInTheDocument();
        expect(screen.getByText(/placing true/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Map place" }));

        await waitFor(() => expect(screen.getByText("Rosslyn Depot is now on the map.")).toBeInTheDocument());
        expect(patchBodies).toEqual([{ latitude: -25.755555, longitude: 28.231111 }]);
        expect(screen.queryByRole("heading", { name: /Not on the map/ })).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByText(/^3 on map, selected b3/)).toBeInTheDocument());
    });

    it("keeps the placement open with the reason when saving fails", async () => {
        const user = userEvent.setup();
        mockApi({ patchStatus: 403 });
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toBeInTheDocument());

        await user.click(screen.getByRole("button", { name: "Place" }));
        await user.click(screen.getByRole("button", { name: "Map place" }));

        expect(await screen.findByText("You do not have permission to edit the building")).toBeInTheDocument();
        await user.keyboard("{Escape}");
        expect(screen.queryByText(/Click the map where/)).not.toBeInTheDocument();
    });

    it("doesn't offer placement to viewers", async () => {
        mockApi();
        renderView("VIEWER");
        await waitFor(() => expect(row("Hatfield Park")).toBeInTheDocument());

        expect(screen.getByText("These buildings have no coordinates yet.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Place" })).not.toBeInTheDocument();
    });

    it("explains an empty map", async () => {
        mockApi({ buildings: BUILDINGS.map((building) => ({ ...building, latitude: null, longitude: null })) });
        renderView();

        expect(await screen.findByText("None of your buildings are on the map yet")).toBeInTheDocument();
        expect(screen.getByText("Choose Place on a building in the list, then click where it stands.")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Place" })).toHaveLength(3);
    });

    it("keeps the ranking useful when the map cannot draw", async () => {
        const user = userEvent.setup();
        mockApi();
        renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));

        await user.click(screen.getByRole("button", { name: "Map fail" }));

        expect(screen.getByText("Map unavailable")).toBeInTheDocument();
        expect(row("Hatfield Park")).toHaveTextContent("42.0 kW");
        expect(screen.getByRole("button", { name: "Place" })).toBeDisabled();
    });


    it("adds up live sensor readings as they stream in", async () => {
        mockApi();
        const { refresh } = renderView();
        await waitFor(() => expect(row("Hatfield Park")).toHaveTextContent("42.0 kW"));
        expect(row("Brooklyn Clinic")).toHaveTextContent("13.0 kW");

        streamState = {
            isConnected: true,
            liveData: { building_id: "b2", sensor_id: "s1", power_kw: 61.5, timestamp: new Date().toISOString() },
        };
        await act(async () => {
            refresh();
        });
        streamState = {
            isConnected: true,
            liveData: { building_id: "b2", sensor_id: "s2", power_kw: 8.5, timestamp: new Date().toISOString() },
        };
        await act(async () => {
            refresh();
        });

        expect(row("Brooklyn Clinic")).toHaveTextContent("70.0 kW");
        expect(within(ranking()).getAllByRole("button", { name: /Park|Clinic/ })[0]).toHaveTextContent("Brooklyn Clinic");
        expect(screen.getByText("Live stream receiving")).toBeInTheDocument();
        expect(screen.getByTestId("map-values")).toHaveTextContent("b2=70");
    });

    it("puts the building named in the link at foucs", async () => {
        mockUseSearchParams.mockReturnValue(new URLSearchParams("building=b2") as never);
        mockApi();
        renderView();

        expect(await screen.findByRole("region", { name: "Brooklyn Clinic on the heatmap" })).toBeInTheDocument();
    });


    it("plays the timeline from the start when it is at the end", async () => {
        const user = userEvent.setup();
        mockApi({ heatmap: { "+90d": { b1: 10, b2: 20 }, "-90d": { b1: 5, b2: 6 }, live: { b1: 1, b2: 2 } } });
        mockUseSearchParams.mockReturnValue(new URLSearchParams("timeframe=%2B90d") as never);
        renderView();
        await waitFor(() => expect(row("Brooklyn Clinic")).toHaveTextContent("20.0 kWh/day"));

        await user.click(screen.getByRole("button", { name: /play the timeline/i }));

        expect(screen.getByRole("button", { name: "Pause the timeline" })).toHaveAttribute("aria-pressed", "true");
        await waitFor(() => expect(screen.getByRole("button", { name: "Last 90 days" })).toHaveAttribute("aria-pressed", "true"));

        await user.click(screen.getByRole("button", { name: "Pause the timeline" }));
        expect(screen.getByRole("button", { name: /play the timeline/i })).toHaveAttribute("aria-pressed", "false");
    });
});