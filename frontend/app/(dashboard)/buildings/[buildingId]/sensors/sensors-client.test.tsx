import React from "react";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SensorsClient from "./sensors-client";

const mockBuildings = [
    { building_id: "b1", building_name: "Sandton HQ" },
    { building_id: "b2", building_name: "Green Park" },
];

const mockSensors = [
    {
        sensor_id: "s1",
        building_id: "b1",
        mac_address: "AA:BB:CC:00:00:01",
        sensor_type: "Energy meter",
        unit: "kWh",
        location_zone: "Main incomer",
        status: "Active",
        installed_date: "2026-02-15T00:00:00.000Z"
    },
    {
        sensor_id: "s2",
        building_id: "b1",
        mac_address: "AA:BB:CC:00:00:02",
        sensor_type: "HVAC meter",
        unit: "kWh",
        location_zone: "Roof plant room",
        status: "Maintenance",
        installed_date: "2026-05-07T00:00:00.000Z"
    },
];

const jsonResponse = (data: unknown, ok = true) => ({
    ok,
    json: async () => data
});
// the client talks to /api/buildings and /api/sensors so the mock needs to use both URL and method
const mockFetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/buildings")) {
        return Promise.resolve(jsonResponse({
            status: "success",
            data: mockBuildings
        }));
    }

    if (url.startsWith("/api/sensors?")) {
        return Promise.resolve(jsonResponse({
            status: "success",
            data: mockSensors
        }));
    }

    if (url === "/api/sensors" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return Promise.resolve(
            jsonResponse({
                status: "success",
                data: { sensor_id: "s-new", ...body }
            }));
    }
    if (url.startsWith("/api/sensors/") && init?.method === "DELETE") {
        return Promise.resolve(jsonResponse({
            status: "success",
            message: "Sensor successfully deleted"
        }));
    }
    return Promise.resolve(jsonResponse({ message: "Not found" }, false));
};

const renderPage = async (role = "BUILDING_MANAGER", buildingId = "b1") => {
    render(<SensorsClient role={role} buildingId={buildingId} />);
    expect(await screen.findByText("AA:BB:CC:00:00:01")).toBeInTheDocument();
};

beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(mockFetchImplementation) as jest.Mock;
    jest.spyOn(window, "confirm").mockImplementation(() => true);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("SensorsClient", () => {
    it("shows the building name in the heading", async () => {
        await renderPage();
        expect(screen.getByRole("heading", { name: /Sandton HQ - Sensors/i })).toBeInTheDocument();
    });

    it("lists the sensors registered for the building", async () => {
        await renderPage();
        expect(screen.getByText("AA:BB:CC:00:00:01")).toBeInTheDocument();
        expect(screen.getByText("AA:BB:CC:00:00:02")).toBeInTheDocument();

        expect(screen.getByText(/2 sensors registered/i)).toBeInTheDocument();
    });

    it("requests the sensors of this building only", async () => {
        await renderPage();
        expect(global.fetch).toHaveBeenCalledWith("/api/sensors?building_id=b1", expect.objectContaining({ method: "GET" }));
    });

    it("links back to the building details page", async () => {
        await renderPage();
        expect(
            screen.getByRole("link", { name: /back to building/i })
        ).toHaveAttribute("href", "/buildings/b1/view");
    });
    it("opens the sensor details when the View button is clicked", async () => {
        await renderPage();
        const row = screen.getByText("AA:BB:CC:00:00:02").closest("tr")!;
        fireEvent.click(within(row).getByRole("button", { name: /view/i }));
        const modal = screen.getByRole("heading", { name: /Sensor details/i }).closest("div")!;

        expect(within(modal).getByText("Sandton HQ")).toBeInTheDocument();
        expect(within(modal).getByText("Roof plant room")).toBeInTheDocument();
        expect(within(modal).getByText("2026-05-07")).toBeInTheDocument();
    });

    it("allows the viewers to view sensors but does not allow to manage them", async () => {
        await renderPage("VIEWER");
        expect(screen.getAllByRole("button", { name: /view/i }).length).toBeGreaterThan(0);
        expect(screen.queryByRole("button", { name: /register sensor/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });

    it("registers a new sensor for the building", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /register sensor/i }));
        fireEvent.change(screen.getByLabelText(/MAC address/i), {
            target: { value: "11:22:33:44:55:66" },
        });
        fireEvent.change(screen.getByLabelText(/Location zone/i), {
            target: { value: "Basement" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^register$/i }));

        expect(await screen.findByText("11:22:33:44:55:66")).toBeInTheDocument();
        expect(screen.getByText("Basement")).toBeInTheDocument();
        expect(screen.getByText(/3 sensors registered/i)).toBeInTheDocument();

        // the registration must be for this building
        expect(global.fetch).toHaveBeenCalledWith("/api/sensors", expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"building_id":"b1"')
        })
        );
    });

    it("shows the backend error when the registration is rejected", async () => {
        await renderPage();
        (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input) === "/api/sensors" && init?.method === "POST") {
                return Promise.resolve(jsonResponse({
                    status: "error",
                    message: "A sensor with this MAC address is already registered"
                }, false));
            }
            return mockFetchImplementation(input, init);
        });

        fireEvent.click(screen.getByRole("button", { name: /register sensor/i }));
        fireEvent.change(screen.getByLabelText(/MAC address/i), {
            target: { value: "11:22:33:44:55:77" }
        });
        fireEvent.click(screen.getByRole("button", { name: /^register$/i }));

        expect(await screen.findByText(/already registered/i)).toBeInTheDocument();
    });

    it("rejects an invalid MAC address", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /register sensor/i }));
        fireEvent.change(screen.getByLabelText(/MAC address/i), {
            target: { value: "not-a-mac" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^register$/i }));
        expect(screen.getByText(/MAC address must look like/i)).toBeInTheDocument();
    });

    it("rejects a duplicate MAC address", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /register sensor/i }));
        fireEvent.change(screen.getByLabelText(/MAC address/i), {
            target: { value: "aa:bb:cc:00:00:01" },
        });
        fireEvent.click(screen.getByRole("button", { name: /^register$/i }));
        expect(screen.getByText(/already registered/i)).toBeInTheDocument();
    });

    it("deletes a sensor after confirmation of the deletion", async () => {
        await renderPage();
        const row = screen.getByText("AA:BB:CC:00:00:02").closest("tr")!;
        fireEvent.click(within(row).getByRole("button", { name: /delete/i }));

        const modal = await screen.findByText("Delete sensor");
        const modalContainer = modal.closest('.modal-overlay');
        fireEvent.click(within(modalContainer as HTMLElement).getByRole("button", { name: /^delete$/i }));

        await waitFor(() => expect(screen.queryByText("AA:BB:CC:00:00:02")).not.toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledWith("/api/sensors/s2", expect.objectContaining({ method: "DELETE" }));
    });

    it("shows an error when the building does not belong to the user", async () => {
        render(<SensorsClient role="VIEWER" buildingId="unknown" />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Building not found.");
    });
    it("shows an error message when buildings cannot be loaded ", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ message: "Authentication required." }, false));

        render(<SensorsClient role="VIEWER" buildingId="b1" />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Authentication required.");
    });
});