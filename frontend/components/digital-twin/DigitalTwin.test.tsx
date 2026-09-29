import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DigitalTwin from "./DigitalTwin";
import type { TwinSceneProps } from "./TwinScene";
import { useTelemetryStream, type TelemetryData } from "@/lib/useTelemetryStream";

jest.mock("@/lib/useTelemetryStream", () => ({
    useTelemetryStream: jest.fn(),
}));

jest.mock("./TwinScene", () => ({
    __esModule: true,
    default: (props: TwinSceneProps) => (
        <div data-testid="twin-scene">
            <span>
                {`${props.layout.placements.length} sensors on ${props.layout.floors} floors, lens ${props.lens}, selected ${props.selectedId ?? "none"}, reset ${props.resetToken}, active ${String(props.active)}`}
            </span>
            <button type="button" onClick={() => props.onSelect(props.layout.placements[0]?.sensor.sensor_id ?? null)}>Pick in scene</button>
            <button type="button" onClick={() => props.onContextLost()}>Lose context</button>
        </div>
    ),
}));

const mockUseTelemetryStream = useTelemetryStream as jest.MockedFunction<typeof useTelemetryStream>;

const building = {
    building_id: "building-1",
    building_name: "Hatfield Block C",
    building_type: "Commercial",
    square_footage: 2500,
    nominal_voltage: 230,
    max_current_threshold: 60,
};

const sensors = [
    { sensor_id: "sensor-zone", building_id: "building-1", mac_address: "AA:BB:CC:DD:EE:01", sensor_type: "Energy Monitor", location_zone: "Zone 1", status: "Active" },
    { sensor_id: "sensor-main", building_id: "building-1", mac_address: "AA:BB:CC:DD:EE:02", sensor_type: "MultiMeter", location_zone: "Main incomer", status: "Active" },
];

type StreamState = { isConnected: boolean; error: Error | null };

let streamState: StreamState;
let pushReading: (reading: TelemetryData) => void;
let getContextSpy: jest.SpyInstance;

function jsonResponse(status: number, body: unknown) {
    return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
}

function mockApi({
    sensorList = sensors,
    sensorStatus = 200,
    snapshotStatus = 404,
    snapshotRows = [] as unknown[],
} = {}) {
    global.fetch = jest.fn().mockImplementation((url: string) => {
        if (url.startsWith("/api/sensors")) {
            return sensorStatus === 200
                ? jsonResponse(200, { status: "success", data: sensorList })
                : jsonResponse(sensorStatus, { message: "Sensor service is unavailable." });
        }
        if (url.endsWith("/sensors/live")) {
            return snapshotStatus === 200
                ? jsonResponse(200, { status: "success", data: snapshotRows })
                : jsonResponse(snapshotStatus, { status: "error", message: "Not found" });
        }
        return jsonResponse(404, {});
    }) as jest.Mock;
}

function renderTwin() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <DigitalTwin building={building} />
        </QueryClientProvider>,
    );
}

function sensorRow(name: string) {
    return screen.getByRole("button", { name: new RegExp(`^${name}`) });
}

function live(sensorId: string, powerKw: number, currentA: number): TelemetryData {
    return {
        building_id: "building-1",
        sensor_id: sensorId,
        power_kw: powerKw,
        current_a: currentA,
        voltage_v: 229.6,
        timestamp: new Date().toISOString(),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    streamState = { isConnected: false, error: null };
    mockUseTelemetryStream.mockImplementation((_buildingId, options) => {
        pushReading = (reading) => options?.onReading?.(reading);
        return { liveData: null, ...streamState };
    });
    getContextSpy = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
        () => ({}) as unknown as RenderingContext,
    );
    document.body.style.overflow = "";
});

afterEach(() => {
    getContextSpy.mockRestore();
});

describe("DigitalTwin", () => {
    it("places every registered sensor in the model and lists them", async () => {
        mockApi();
        renderTwin();
        expect(await screen.findByText("2 sensors on 4 floors, lens circuit, selected none, reset 0, active true")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Hatfield Block C in 3D" })).toBeInTheDocument();
        expect(sensorRow("Zone 1")).toHaveTextContent("Waiting for data");
        expect(sensorRow("Main incomer")).toHaveTextContent("Waiting for data");
        expect(screen.getByRole("group", { name: "Live building summary" })).toHaveTextContent("Reporting0 of 2");
        expect(screen.getByText("Connecting")).toBeInTheDocument();
        expect(mockUseTelemetryStream).toHaveBeenCalledWith("building-1", expect.objectContaining({ trackLatest: false }));
        expect(screen.getByRole("img", { name: /3D model of Hatfield Block C across 4 floors with 2 sensors/ })).toBeInTheDocument();
    });

    it("lights up sensors when the live readings stream in", async () => {
        streamState = { isConnected: true, error: null };
        mockApi();
        renderTwin();
        await screen.findByText(/2 sensors on 4 floors/);

        act(() => {
            pushReading(live("sensor-zone", 12.4, 54));
            pushReading(live("sensor-main", 3.1, 13.2));
            pushReading({ ...live("sensor-zone", 99, 99), building_id: "someone-else" });
        });

        await waitFor(() => expect(sensorRow("Zone 1")).toHaveTextContent("12.4 kW"));
        expect(sensorRow("Zone 1")).toHaveTextContent("Critical, 90% of 60 A");
        expect(sensorRow("Main incomer")).toHaveTextContent("Normal, 22% of 60 A");
        const summary = screen.getByRole("group", { name: "Live building summary" });
        expect(summary).toHaveTextContent("Live load15.5 kW");
        expect(summary).toHaveTextContent("Reporting2 of 2");
        expect(summary).toHaveTextContent("Need attention1");
        expect(screen.getByText("Live")).toBeInTheDocument();
        expect(screen.getByText("Busiest: Zone 1")).toBeInTheDocument();

        const rows = within(screen.getByRole("complementary", { name: "Sensors in the model" })).getAllByRole("button");
        expect(rows[0]).toHaveTextContent("Zone 1");
    });

    it("switches between circuit load and deviation colouring", async () => {
        const user = userEvent.setup();
        mockApi();
        renderTwin();
        await screen.findByText(/lens circuit/);
        act(() => pushReading(live("sensor-zone", 12.4, 54)));
        await waitFor(() => expect(sensorRow("Zone 1")).toHaveTextContent("Critical"));

        await user.click(screen.getByRole("radio", { name: "Deviation" }));

        expect(screen.getByRole("radio", { name: "Deviation" })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByRole("radio", { name: "Circuit load" })).toHaveAttribute("aria-checked", "false");
        expect(screen.getByText(/lens deviation/)).toBeInTheDocument();
        expect(screen.getByText("Drift from normal draw")).toBeInTheDocument();
        expect(sensorRow("Zone 1")).toHaveTextContent("Learning normal");
    });

    it("inspects a sensor picked from the list or from the scene", async () => {
        const user = userEvent.setup();
        mockApi();
        renderTwin();
        await screen.findByText(/selected none/);
        act(() => pushReading(live("sensor-zone", 12.4, 54)));
        await waitFor(() => expect(sensorRow("Zone 1")).toHaveTextContent("12.4 kW"));

        await user.click(sensorRow("Zone 1"));

        const inspector = screen.getByRole("region", { name: "Zone 1 details" });
        expect(inspector).toHaveTextContent("Energy Monitor, AA:BB:CC:DD:EE:01");
        expect(inspector).toHaveTextContent("54.0 A");
        expect(inspector).toHaveTextContent("229.6 V");
        expect(inspector).toHaveTextContent("90% of 60 A");
        expect(inspector).toHaveTextContent("Learning normal");
        expect(within(inspector).getByText("Critical")).toHaveClass("badge-danger");
        expect(screen.getByText(/selected sensor-zone/)).toBeInTheDocument();
        expect(sensorRow("Zone 1")).toHaveAttribute("aria-pressed", "true");

        await user.click(within(inspector).getByRole("button", { name: "Close sensor details" }));
        expect(screen.queryByRole("region", { name: "Zone 1 details" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Pick in scene" }));
        expect(screen.getByRole("region", { name: "Main incomer details" })).toHaveTextContent("Waiting for data");

        await user.click(screen.getByRole("button", { name: "Reset view" }));
        expect(screen.queryByRole("region", { name: "Main incomer details" })).not.toBeInTheDocument();
        expect(screen.getByText(/selected none, reset 1/)).toBeInTheDocument();
    });

    
    it("carries on quietly when the snapshot endpoint does not exist yet", async () => {
        mockApi({ snapshotStatus: 404 });
        renderTwin();

        await screen.findByText(/2 sensors/);
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/buildings/building-1/sensors/live", expect.anything()));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });


    it("shows the latest snapshot before the stream delivers anything", async () => {
        mockApi({
            snapshotStatus: 200,
            snapshotRows: [{ sensor_id: "sensor-main", power_kw: 7.2, current_a: 31.3, timestamp: new Date().toISOString() }],
        });
        renderTwin();

        await waitFor(() => expect(sensorRow("Main incomer")).toHaveTextContent("7.2 kW"));
        expect(global.fetch).toHaveBeenCalledWith("/api/buildings/building-1/sensors/live", { method: "GET", cache: "no-store" });
    });

    it("explains when a stream is reconnecting", async () => {
        streamState = { isConnected: false, error: new Error("Lost connection to telemetry stream.") };
        mockApi();
        renderTwin();

        expect(await screen.findByText("Reconnecting")).toBeInTheDocument();
    });

    it("invites the team to register sensors when there are no sensors registered", async () => {
        mockApi({ sensorList: [] });
        renderTwin();

        expect(await screen.findByText(/No sensors are registered for this building yet/)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Manage sensors" })).toHaveAttribute("href", "/buildings/building-1/sensors");
        expect(screen.getByText(/0 sensors on 4 floors/)).toBeInTheDocument();
    });

    it("keeps the sensor list useful even without WebGL", async () => {
        getContextSpy.mockImplementation(() => null);
        mockApi();
        renderTwin();

        expect(await screen.findByText("3D view unavailable")).toBeInTheDocument();
        expect(screen.queryByTestId("twin-scene")).not.toBeInTheDocument();
        await waitFor(() => expect(sensorRow("Zone 1")).toBeInTheDocument());
    });

    it("lets the user retry when the sensors fail to load", async () => {
        const user = userEvent.setup();
        mockApi({ sensorStatus: 500 });
        renderTwin();

        expect(await screen.findByRole("alert")).toHaveTextContent("Sensor service is unavailable.");

        mockApi();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() => expect(sensorRow("Zone 1")).toBeInTheDocument());
    });

    it("restarts the scene after the browser drops the graphics context", async () => {
        const user = userEvent.setup();
        mockApi();
        renderTwin();

        await user.click(await screen.findByRole("button", { name: "Lose context" }));
        expect(screen.getByText("3D view paused")).toBeInTheDocument();
        expect(screen.queryByTestId("twin-scene")).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Restart 3D view" }));
        expect(await screen.findByTestId("twin-scene")).toBeInTheDocument();
    });


    it("filters a long list of sensors", async () => {
        const user = userEvent.setup();
        const many = Array.from({ length: 8 }, (_, index) => ({
            ...sensors[0],
            sensor_id: `sensor-${index}`,
            mac_address: `AA:BB:CC:DD:EE:1${index}`,
            location_zone: `Zone ${index + 1}`,
        }));
        mockApi({ sensorList: many });
        renderTwin();
        await waitFor(() => expect(sensorRow("Zone 8")).toBeInTheDocument());

        await user.type(screen.getByRole("searchbox", { name: "Filter sensors" }), "zone 3");

        const panel = screen.getByRole("complementary", { name: "Sensors in the model" });
        expect(within(panel).getAllByRole("button")).toHaveLength(1);
        expect(sensorRow("Zone 3")).toBeInTheDocument();

        await user.clear(screen.getByRole("searchbox", { name: "Filter sensors" }));
        await user.type(screen.getByRole("searchbox", { name: "Filter sensors" }), "nothing like this");
        expect(screen.getByText("No sensors match that filter.")).toBeInTheDocument();
    });

        it("opens a full view that closes using Escape", async () => {
        const user = userEvent.setup();
        mockApi();
        const { container } = renderTwin();
        await screen.findByTestId("twin-scene");
        const section = container.querySelector("#digital-twin");

        await user.click(screen.getByRole("button", { name: "Full view" }));
        expect(section).toHaveClass("twin-expanded");
        expect(screen.getByRole("button", { name: "Exit full view" })).toHaveAttribute("aria-pressed", "true");
        expect(document.body.style.overflow).toBe("hidden");

        fireEvent.keyDown(document, { key: "Escape" });
        expect(section).not.toHaveClass("twin-expanded");
        expect(document.body.style.overflow).toBe("");
    });
});
