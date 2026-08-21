import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ViewBuildingPage from "./page";
import { useTelemetryStream } from "@/lib/useTelemetryStream";

jest.mock("@/lib/useTelemetryStream", () => ({
    useTelemetryStream: jest.fn(),
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

const mockUseTelemetryStream = useTelemetryStream as jest.MockedFunction<typeof useTelemetryStream>;

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
    mockUseTelemetryStream.mockReturnValue({
      liveData: null,
      isConnected: true,
      error: null,
    });
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
    await waitFor(() => expect(mockUseTelemetryStream).toHaveBeenLastCalledWith("111"));
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
      expect(screen.getByText("Online (Waiting for reading)")).toBeInTheDocument();
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

  it("renders live telemetry for the opened building", async () => {
    mockUseTelemetryStream.mockReturnValue({
      liveData: {
        building_id: "111",
        sensor_id: "sensor-111",
        source_type: "EMULATOR",
        power_kw: 12.345,
        voltage_v: 231.2,
        current_a: 53.4,
        timestamp: "2026-07-17T10:30:00.000Z",
      },
      isConnected: true,
      error: null,
    });
    mockFetchOk();

    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Real-Time Telemetry" })).toBeInTheDocument();
      expect(screen.getByText("Online (Streaming)")).toBeInTheDocument();
      expect(screen.getByText("EMULATOR")).toBeInTheDocument();
      expect(screen.getByText("sensor-111")).toBeInTheDocument();
      expect(screen.getByText("12.35 kW")).toBeInTheDocument();
      expect(screen.getByText("231.2 V")).toBeInTheDocument();
      expect(screen.getByText("53.4 A")).toBeInTheDocument();
    });
  });

  it("does not show telemetry from a different building", async () => {
    mockUseTelemetryStream.mockReturnValue({
      liveData: {
        building_id: "222",
        sensor_id: "sensor-222",
        power_kw: 99,
        voltage_v: 240,
        current_a: 75,
        timestamp: "2026-07-17T10:30:00.000Z",
      },
      isConnected: true,
      error: null,
    });
    mockFetchOk();

    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Real-Time Telemetry" })).toBeInTheDocument();
      expect(screen.queryByText("99 kW")).not.toBeInTheDocument();
      expect(screen.queryByText("240 V")).not.toBeInTheDocument();
      expect(screen.queryByText("75 A")).not.toBeInTheDocument();
    });
  });

  it("shows telemetry stream errors", async () => {
    mockUseTelemetryStream.mockReturnValue({
      liveData: null,
      isConnected: false,
      error: new Error("Lost connection to telemetry stream."),
    });
    mockFetchOk();

    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() => {
      expect(screen.getByText("Offline / Connecting")).toBeInTheDocument();
      expect(screen.getByText("Lost connection to telemetry stream.")).toBeInTheDocument();
    });
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
