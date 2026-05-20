import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("CompareBuildingPage Component", () => {
  beforeEach(() => {
    
    document.head.innerHTML = "";
  });

  test("renders initial UI elements correctly", () => {
    render(<CompareBuildingPage />);

    
    expect(screen.getByRole("heading", { name: /compare buildings/i })).toBeInTheDocument();

    
    const dropdowns = screen.getAllByRole("combobox");
    expect(dropdowns).toHaveLength(4);

    
    expect(dropdowns[0]).toHaveValue("Building A");
    expect(dropdowns[1]).toHaveValue("Building B");
    expect(dropdowns[2]).toHaveValue("30"); 
    expect(dropdowns[3]).toHaveValue("R");  
  });

  test("injects Google Font stylesheets on mount", () => {
    render(<CompareBuildingPage />);

    const links = document.head.querySelectorAll("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", expect.stringContaining("family=Inter"));
    expect(links[1]).toHaveAttribute("href", expect.stringContaining("family=Space+Grotesk"));
    expect(links[2]).toHaveAttribute("href", expect.stringContaining("family=JetBrains+Mono"));
  });

  test("displays correct base building calculation values initially", () => {
    render(<CompareBuildingPage />);

    
    expect(screen.getByText(/12,500/)).toBeInTheDocument();
    expect(screen.getByText(/2,500\s*m²/)).toBeInTheDocument();

    
    expect(screen.getByText(/9,800/)).toBeInTheDocument();
    expect(screen.getByText(/1,800\s*m²/)).toBeInTheDocument();
  });

  test("updates calculations and headers when changing building selectors", () => {
    render(<CompareBuildingPage />);

    const [buildingASelect, buildingBSelect] = screen.getAllByRole("combobox");

   
    fireEvent.change(buildingASelect, { target: { value: "Sandton HQ" } });
    expect(screen.getByRole("heading", { name: "Sandton HQ" })).toBeInTheDocument();
   
    expect(screen.getByText(/14,200/)).toBeInTheDocument();

    
    fireEvent.change(buildingBSelect, { target: { value: "Greenwood Tower" } });
    expect(screen.getByRole("heading", { name: "Greenwood Tower" })).toBeInTheDocument();
    
    expect(screen.getByText(/7,600/)).toBeInTheDocument();
  });

  test("calculates multiplier alterations accurately when metric or date range shifts", () => {
    render(<CompareBuildingPage />);

    const dropdowns = screen.getAllByRole("combobox");
    const dateRangeSelect = dropdowns[2];
    const metricSelect = dropdowns[3];

   
    fireEvent.change(dateRangeSelect, { target: { value: "7" } });
    expect(screen.getByText(/3,125/)).toBeInTheDocument();

    
    fireEvent.change(metricSelect, { target: { value: "kWh" } });
    expect(screen.getByText(/2,050/)).toBeInTheDocument();
    
   
    expect(screen.getByText(/Energy Consumption Comparison \(kWh\)/i)).toBeInTheDocument();
    expect(screen.getByText(/7 days • Weekly breakdown/i)).toBeInTheDocument();
  });
});