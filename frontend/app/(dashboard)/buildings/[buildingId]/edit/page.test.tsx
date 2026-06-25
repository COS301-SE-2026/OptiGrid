import React from "react";
import EditBuildingPage from "./page";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const BUILDING_ID = "aaaaaaaa-0000-0000-0000-000000000001";

const BASE_BUILDING = {
    building_id: BUILDING_ID,
    building_name: "Test Building",
    physical_address: "1 Main St",
    square_footage: 500,
    timezone: "Africa/Johannesburg",
    max_occupancy: 20,
    latitude: -25.7461,
    longitude: 28.1881,
    geohash: "ke7fq",
};

function makeParams(id = BUILDING_ID): Promise<{ buildingId: string }> {
    return Promise.resolve({ buildingId: id });
}

function mockFetchGet(building: object | null, ok = true, message?: string) {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url === "/api/buildings") {
            return Promise.resolve({
                ok,
                json: async () => ok ? { data: building ? [building] : [] } : { message },
            } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({ status: "success" }) } as Response);
    });
}

function mockFetchPatch(ok = true, message?: string, building: object = BASE_BUILDING) {
    (global.fetch as jest.Mock).mockImplementation((url: string, opts?: RequestInit) => {
        if (url === "/api/buildings") {
            return Promise.resolve({
                ok: true,
                json: async () => ({ data: [building] }),
            } as Response);
        }
        if (url.startsWith("/api/buildings/") && opts?.method === "PATCH") {
            return Promise.resolve({
                ok,
                json: async () => ok ? { status: "success" } : { message: message ?? "Update failed" },
            } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });
}

async function renderAndLoad(building: object | null = BASE_BUILDING) {
    mockFetchGet(building);
    render(<EditBuildingPage params={makeParams()} />);
    if (building) {
        await waitFor(() => expect(screen.getByLabelText(/building name/i)).toBeInTheDocument());
    } else {
        await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument());
    }
}

// Used when the fetch mock is already set up before calling render
async function renderAndWait() {
    render(<EditBuildingPage params={makeParams()} />);
    await waitFor(() => expect(screen.getByLabelText(/building name/i)).toBeInTheDocument());
}

beforeEach(() => {
    jest.useFakeTimers();
    (global.fetch as jest.Mock) = jest.fn();
    mockPush.mockClear();
    mockRefresh.mockClear();
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe("Loading state", () => {
    it("shows the loading message while the GET request is in flight", () => {
        (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
        render(<EditBuildingPage params={makeParams()} />);
        expect(screen.getByText(/loading building details/i)).toBeInTheDocument();
    });

    it("does not show the form while it is loading", () => {
        (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));
        render(<EditBuildingPage params={makeParams()} />);
        expect(screen.queryByRole("form")).not.toBeInTheDocument();
    });
});

describe("Error states", () => {
    it("shows the Edit Building heading even on a load error", async () => {
        mockFetchGet(null, false, "Server error");
        render(<EditBuildingPage params={makeParams()} />);
        await waitFor(() =>
            expect(screen.getByRole("heading", { name: /edit building/i })).toBeInTheDocument(),
        );
    });

    it("shows the API error message when GET returns not ok", async () => {
        mockFetchGet(null, false, "Unauthorised");
        render(<EditBuildingPage params={makeParams()} />);
        await waitFor(() => expect(screen.getByText(/unauthorised/i)).toBeInTheDocument());
    });

    it("falls back to a generic message when the API error has no message", async () => {
        mockFetchGet(null, false);
        render(<EditBuildingPage params={makeParams()} />);
        await waitFor(() => expect(screen.getByText(/unable to load buildings/i)).toBeInTheDocument());
    });

    it("shows Building not found when the building id is not in the list", async () => {
        mockFetchGet(null, true);
        render(<EditBuildingPage params={makeParams()} />);
        await waitFor(() => expect(screen.getByText(/building not found/i)).toBeInTheDocument());
    });

    it("does not render the form when there is a load error", async () => {
        mockFetchGet(null, false, "error");
        render(<EditBuildingPage params={makeParams()} />);
        await waitFor(() => expect(screen.queryByLabelText(/building name/i)).not.toBeInTheDocument());
    });
});

describe("Form population from building data", () => {
    it("populates all fields from the loaded building", async () => {
        await renderAndLoad();
        expect(screen.getByLabelText(/building name/i)).toHaveValue("Test Building");
        expect(screen.getByLabelText(/address/i)).toHaveValue("1 Main St");
        expect(screen.getByLabelText(/square footage/i)).toHaveValue("500");
        expect(screen.getByLabelText(/max occupancy/i)).toHaveValue("20");
        expect(screen.getByLabelText(/timezone/i)).toHaveValue("Africa/Johannesburg");
        expect(screen.getByLabelText(/^latitude$/i)).toHaveValue("-25.7461");
        expect(screen.getByLabelText(/^longitude$/i)).toHaveValue("28.1881");
        expect(screen.getByLabelText(/^geohash$/i)).toHaveValue("ke7fq");
    });

    it("defaults timezone to UTC when building has no timezone", async () => {
        await renderAndLoad({ ...BASE_BUILDING, timezone: null });
        expect(screen.getByLabelText(/timezone/i)).toHaveValue("UTC");
    });

    it("leaves square footage empty when building has none", async () => {
        await renderAndLoad({ ...BASE_BUILDING, square_footage: null });
        expect(screen.getByLabelText(/square footage/i)).toHaveValue("");
    });

    it("leaves max occupancy empty when building has none", async () => {
        await renderAndLoad({ ...BASE_BUILDING, max_occupancy: null });
        expect(screen.getByLabelText(/max occupancy/i)).toHaveValue("");
    });

    it("leaves address empty when building has none", async () => {
        await renderAndLoad({ ...BASE_BUILDING, physical_address: null });
        expect(screen.getByLabelText(/address/i)).toHaveValue("");
    });

    it("leaves latitude empty when building returns null", async () => {
        await renderAndLoad({ ...BASE_BUILDING, latitude: null });
        expect(screen.getByLabelText(/^latitude$/i)).toHaveValue("");
    });

    it("leaves longitude empty when building returns null", async () => {
        await renderAndLoad({ ...BASE_BUILDING, longitude: null });
        expect(screen.getByLabelText(/^longitude$/i)).toHaveValue("");
    });

    it("leaves geohash empty when building returns null", async () => {
        await renderAndLoad({ ...BASE_BUILDING, geohash: null });
        expect(screen.getByLabelText(/^geohash$/i)).toHaveValue("");
    });
});

describe("PATCH payload on submit", () => {
    function getPatchBody() {
        const calls = (global.fetch as jest.Mock).mock.calls;
        const patchCall = calls.find(
            ([url, opts]: [string, RequestInit]) =>
                url.startsWith("/api/buildings/") && opts?.method === "PATCH",
        );
        expect(patchCall).toBeTruthy();
        return JSON.parse(patchCall![1].body as string);
    }

    it("sends PATCH to the correct building URL", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => {
            const calls = (global.fetch as jest.Mock).mock.calls;
            expect(
                calls.some(([url, opts]: [string, RequestInit]) =>
                    url === `/api/buildings/${BUILDING_ID}` && opts?.method === "PATCH",
                ),
            ).toBe(true);
        });
    });

    it("sends the correct fields with numeric coercion", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => {
            const body = getPatchBody();
            expect(body).toMatchObject({
                building_name: "Test Building",
                physical_address: "1 Main St",
                timezone: "Africa/Johannesburg",
                square_footage: 500,
                max_occupancy: 20,
            });
        });
    });

    it("omits square_footage when the field is empty", async () => {
        mockFetchPatch(true, undefined, { ...BASE_BUILDING, square_footage: null });
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("square_footage"));
    });

    it("omits max_occupancy when the field is empty", async () => {
        mockFetchPatch(true, undefined, { ...BASE_BUILDING, max_occupancy: null });
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("max_occupancy"));
    });

    it("omits physical_address when the field is empty", async () => {
        mockFetchPatch(true, undefined, { ...BASE_BUILDING, physical_address: null });
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("physical_address"));
    });

    it("omits timezone when the field is empty", async () => {
        mockFetchPatch(true, undefined, { ...BASE_BUILDING, timezone: null });
        await renderAndWait();
        fireEvent.change(screen.getByLabelText(/timezone/i), { target: { value: "" } });
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("timezone"));
    });

    it("does not send latitude in the payload", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("latitude"));
    });

    it("does not send longitude in the payload", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("longitude"));
    });

    it("does not send geohash in the payload", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(getPatchBody()).not.toHaveProperty("geohash"));
    });

    it("sends Content-Type application/json header", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => {
            const calls = (global.fetch as jest.Mock).mock.calls;
            const patch = calls.find(([url, opts]: [string, RequestInit]) =>
                url.startsWith("/api/buildings/") && opts?.method === "PATCH",
            );
            expect(patch![1].headers).toMatchObject({ "Content-Type": "application/json" });
        });
    });
});

describe("Submit success", () => {
    it("shows the success message after a successful update", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() =>
            expect(screen.getByText(/building updated successfully/i)).toBeInTheDocument(),
        );
    });

    it("redirects to /dashboard after the success timeout", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() =>
            expect(screen.getByText(/building updated successfully/i)).toBeInTheDocument(),
        );
        act(() => jest.advanceTimersByTime(1200));
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("calls router.refresh after the success timeout", async () => {
        mockFetchPatch();
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() =>
            expect(screen.getByText(/building updated successfully/i)).toBeInTheDocument(),
        );
        act(() => jest.advanceTimersByTime(1200));
        expect(mockRefresh).toHaveBeenCalled();
    });
});

describe("Submit error", () => {
    it("shows the API error message when the PATCH fails", async () => {
        mockFetchPatch(false, "Name already taken");
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(screen.getByText(/name already taken/i)).toBeInTheDocument());
    });

    it("shows a fallback error when the PATCH response has no message", async () => {
        mockFetchPatch(false);
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(screen.getByText(/update failed/i)).toBeInTheDocument());
    });

    it("does not show the success message on PATCH failure", async () => {
        mockFetchPatch(false, "Something went wrong");
        await renderAndWait();
        fireEvent.submit(document.querySelector("form")!);
        await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
        expect(screen.queryByText(/building updated successfully/i)).not.toBeInTheDocument();
    });
});

describe("Button states", () => {
    it("both buttons are enabled before submit", async () => {
        await renderAndLoad();
        expect(screen.getByRole("button", { name: /save changes/i })).not.toBeDisabled();
        expect(screen.getByRole("button", { name: /cancel/i })).not.toBeDisabled();
    });

    it("Cancel navigates to /dashboard", async () => {
        await renderAndLoad();
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
});