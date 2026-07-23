import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SensorsClient from "./sensors-client";

const mockBuildings = [
    { building_id: "b1", building_name: "Sandton HQ" },
    { building_id: "b2", building_name: "Green Park" },
];
const renderPage = async (role = "BUILDING_MANAGER", buildingId = "b1") => {
    render(<SensorsClient role={role} buildingId={buildingId} />);
    expect(await screen.findByText("AA:BB:CC:00:00:01")).toBeInTheDocument();
};

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", data: mockBuildings }),
    }) as jest.Mock;

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

        expect(screen.getByText("11:22:33:44:55:66")).toBeInTheDocument();
        expect(screen.getByText("Basement")).toBeInTheDocument();
        expect(screen.getByText(/3 sensors registered/i)).toBeInTheDocument();
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

        expect(window.confirm).toHaveBeenCalled();
        expect(screen.queryByText("AA:BB:CC:00:00:02")).not.toBeInTheDocument();
    });

    it("shows an error when the building does not belong to the user", async () => {
        render(<SensorsClient role="VIEWER" buildingId="unknown" />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Building not found.");
    });
    it("shows an error message when buildings cannot be loaded ", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Authentication required." }),
        });

        render(<SensorsClient role="VIEWER" buildingId="b1" />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Authentication required.");
    });
});