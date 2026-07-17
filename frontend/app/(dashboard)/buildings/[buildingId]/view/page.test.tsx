import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ViewBuildingPage from "./page";

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

function mockFetchOk(building = mockBuilding) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: building }),
  });
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
      expect(screen.getByText("2026-07-17T08:00:00.000Z")).toBeInTheDocument();
    });
  });

  it("shows a backend error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Building not found." }),
    });
    render(<ViewBuildingPage params={makeParams("111")} />);

    await waitFor(() =>
      expect(screen.getByText("Building not found.")).toBeInTheDocument(),
    );
  });
});
