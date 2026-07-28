import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ViewBuildingPage from "./page";

jest.mock("@/lib/useTelemetryStream", () => ({
    useTelemetryStream: jest.fn().mockReturnValue({
        liveData: null,
        isConnected: true,
        error: null,
    }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockBuilding = {
  building_id: "111",
  tenant_id: "tenant-111",
  building_name: "Building A",
  building_type: "OFFICE",
  physical_address: "Johannesburg",
  square_footage: 5000,
  timezone: "Africa/Johannesburg",
  max_occupancy: 200,
  nominal_voltage: 230,
  max_current_threshold: 60,
  lifecycle_state: "ACTIVE",
  created_at: "2026-07-17T08:00:00.000Z",
  updated_at: "2026-07-17T09:00:00.000Z",
  latitude: -26.111,
  longitude: 28.055,
  geohash: "kgesj5h",
};

const makeParams = (buildingId: string) => Promise.resolve({ buildingId });

const mockConsumption = {
  time_range: "30d",
  total_kwh: 900,
  average_daily_kwh: 30,
  total_cost_zar: 1800,
  total_cost_usd: 45,
  cost_per_kwh: 2,
  eui: 0.18,
  total_anomaly_alerts: 0,
  cost_saved_by_recommendations_zar: null,
  peak_usage_times: [{ timestamp: "2026-07-17T08:00:00.000Z", kwh: 120 }],
};

function mockFetchOk(building = mockBuilding, consumption = mockConsumption) {
  global.fetch = jest.fn().mockImplementation((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => ({
        data: url.includes("energy-consumption") ? consumption : building,
      }),
    }),
  );
}

describe("ViewBuildingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the individual building endpoint", async () => {
    mockFetchOk();
    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/buildings/111", {
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/buildings/111/energy-consumption?time_range=30d",
      {
        method: "GET",
        cache: "no-store",
      },
    );
  });

  it("renders the safe building details returned by the endpoint", async () => {
    mockFetchOk();
    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /building details/i })).toBeInTheDocument();
      expect(screen.getByText("Building A")).toBeInTheDocument();
      expect(screen.getByText("tenant-111")).toBeInTheDocument();
      expect(screen.getByText("OFFICE")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      expect(screen.getByText(/5000 m²/)).toBeInTheDocument();
      expect(screen.getByText("200")).toBeInTheDocument();
      expect(screen.getByText("230 V")).toBeInTheDocument();
      expect(screen.getByText("60 A")).toBeInTheDocument();
      expect(screen.getByText("-26.111")).toBeInTheDocument();
      expect(screen.getByText("28.055")).toBeInTheDocument();
      expect(screen.getAllByText("2026-07-17T08:00:00.000Z")).toHaveLength(2);
      expect(screen.getByRole("heading", { name: "Energy Consumption" })).toBeInTheDocument();
      expect(screen.getByText("900 kWh")).toBeInTheDocument();
      expect(screen.getByText("R 1,800")).toBeInTheDocument();
      expect(screen.getByText("120 kWh")).toBeInTheDocument();
    });
  });

  it("reloads consumption when the time range changes", async () => {
    mockFetchOk();
    const user = userEvent.setup();
    render(<ViewBuildingPage params={makeParams("111")} />);

    const timeRange = await screen.findByRole("combobox", {
      name: "Energy consumption time range",
    });
    await user.selectOptions(timeRange, "7d");

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/buildings/111/energy-consumption?time_range=7d",
        {
          method: "GET",
          cache: "no-store",
        },
      ),
    );
  });

  it("shows a consumption error without hiding building details", async () => {
    global.fetch = jest.fn().mockImplementation((url: string) =>
      Promise.resolve(
        url.includes("energy-consumption")
          ? {
              ok: false,
              json: async () => ({ message: "Telemetry is temporarily unavailable." }),
            }
          : {
              ok: true,
              json: async () => ({ data: mockBuilding }),
            },
      ),
    );
    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() => {
      expect(screen.getByText("Building A")).toBeInTheDocument();
      expect(screen.getByText("Telemetry is temporarily unavailable.")).toBeInTheDocument();
    });
  });

  it("shows a backend error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Building not found." }),
    });
    render(<ViewBuildingPage params={makeParams("111")} />);

    expect(await screen.findByText("Building not found.")).toBeInTheDocument();
  });
});
