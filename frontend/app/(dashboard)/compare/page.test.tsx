import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompareBuildingPage from "./page"; 


jest.mock("recharts", () => {
  const originalModule = jest.requireActual("recharts");
  return {
    ...originalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: "100%", height: "100%" }}>{children}</div>
    ),
  };
});

// we need to mock the fetch API to provide data for tests
(global as any).fetch = jest.fn((input: string | Request | URL) => {
  const urlStr = input.toString();
  const params = new URLSearchParams(urlStr.split('?')[1] || '');
  const a = params.get('building_id_a') || 'uuid-1';
  const b = params.get('building_id_b') || 'uuid-2';
  const time = (params.get('time_range') || '30d').replace('d', '');

  const map: any = {
    'uuid-1': {
      '30': { total_cost_zar: 12500, total_kwh: 8200, square_footage: 2500 },
      '7': { total_cost_zar: 3125, total_kwh: 2050, square_footage: 2500 },
    },
    'uuid-2': {
      '30': { total_cost_zar: 9800, total_kwh: 6000, square_footage: 1800 },
      '7': { total_cost_zar: 2450, total_kwh: 1500, square_footage: 1800 },
    },
    'uuid-3': {
      '30': { total_cost_zar: 14200, total_kwh: 9200, square_footage: 2700 },
      '7': { total_cost_zar: 3550, total_kwh: 2300, square_footage: 2700 },
    },
    'uuid-4': {
      '30': { total_cost_zar: 7600, total_kwh: 4100, square_footage: 1400 },
      '7': { total_cost_zar: 1900, total_kwh: 1025, square_footage: 1400 },
    },
  };

  const aData = {
    building_id: a,
    name: a === 'uuid-3' ? 'Sandton HQ' : a === 'uuid-4' ? 'Greenwood Tower' : (a === 'uuid-1' ? 'Building A' : 'Building B'),
    ...(map[a] && map[a][time] ? map[a][time] : map['uuid-1']['30']),
  };

  const bData = {
    building_id: b,
    name: b === 'uuid-3' ? 'Sandton HQ' : b === 'uuid-4' ? 'Greenwood Tower' : (b === 'uuid-1' ? 'Building A' : 'Building B'),
    ...(map[b] && map[b][time] ? map[b][time] : map['uuid-2']['30']),
  };

  const result = { status: 'success', data: { buildingA: aData, buildingB: bData } };

  // return a resolved promise; json() returns synchronously to reduce async timing issues
  return Promise.resolve({ json: () => result });
}) as jest.Mock;

describe("CompareBuildingPage Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    document.head.innerHTML = "";
  });

  test("renders initial UI elements correctly", async () => {
    await act(async () => {
      render(<CompareBuildingPage />);
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: /compare buildings/i })).toBeInTheDocument();

    const dropdowns = screen.getAllByRole("combobox");
    expect(dropdowns).toHaveLength(4);

    // dropdown values are UUIDs
    expect(dropdowns[0]).toHaveValue("uuid-1");
    expect(dropdowns[1]).toHaveValue("uuid-2");
    expect(dropdowns[2]).toHaveValue("30");
    expect(dropdowns[3]).toHaveValue("R");
  });

  test("injects Google Font stylesheets on mount", async () => {
    await act(async () => {
      render(<CompareBuildingPage />);
      await Promise.resolve();
    });

    const links = document.head.querySelectorAll("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("family=Inter"));
    expect(links[1]).toHaveAttribute("href", expect.stringContaining("family=Space+Grotesk"));
    expect(links[2]).toHaveAttribute("href", expect.stringContaining("family=JetBrains+Mono"));
  });

  test("displays correct base building calculation values initially", async () => {
    await act(async () => {
      render(<CompareBuildingPage />);
    });

    expect(await screen.findByText(/12,500/)).toBeInTheDocument();
    expect(await screen.findByText(/2,500\s*m²/)).toBeInTheDocument();
    expect(await screen.findByText(/9,800/)).toBeInTheDocument();
    expect(await screen.findByText(/1,800\s*m²/)).toBeInTheDocument();
  });

  test("updates calculations and headers when changing building selectors", async () => {
    await act(async () => {
      render(<CompareBuildingPage />);
    });

    const [buildingASelect, buildingBSelect] = screen.getAllByRole("combobox");

    // select by UUIDs 
    await act(async () => {
      fireEvent.change(buildingASelect, { target: { value: "uuid-3" } });
    });
    expect(await screen.findByRole("heading", { name: "Sandton HQ" })).toBeInTheDocument();
    expect(await screen.findByText(/14,200/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(buildingBSelect, { target: { value: "uuid-4" } });
    });
    expect(await screen.findByRole("heading", { name: "Greenwood Tower" })).toBeInTheDocument();
    expect(await screen.findByText(/7,600/)).toBeInTheDocument();
  });

  test("calculates multiplier alterations accurately when metric or date range shifts", async () => {
    render(<CompareBuildingPage />);

    const dropdowns = screen.getAllByRole("combobox");
    const dateRangeSelect = dropdowns[2];
    const metricSelect = dropdowns[3];

    await act(async () => {
      fireEvent.change(dateRangeSelect, { target: { value: "7" } });
    });
    expect(await screen.findByText(/3,125/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(metricSelect, { target: { value: "kWh" } });
    });
    expect(await screen.findByText(/2,050/)).toBeInTheDocument();
    expect(await screen.findByText(/Energy Consumption Comparison \(kWh\)/i)).toBeInTheDocument();
    expect(await screen.findByText(/7 days • Weekly breakdown/i)).toBeInTheDocument();
  });
});
