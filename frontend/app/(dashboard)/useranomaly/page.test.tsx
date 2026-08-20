import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ViewerAnomalyPage from "./page";



jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  ComposedChart: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Scatter: () => null,
}));



const getKpiSection = () =>
  screen.getByRole("region", { name: /analytics summary/i });

const getAnomaliesSection = () =>
  screen.getByRole("region", { name: /anomalies list/i });


const getTableCell = (text: string) => {
  const section = getAnomaliesSection();
  return within(section)
    .getAllByRole("cell")
    .find((cell) => cell.textContent?.trim() === text);
};


const getTableRow = (buildingName: string) => {
  const section = getAnomaliesSection();
  const cells = within(section).getAllByRole("cell");
  const cell = cells.find((c) => c.textContent?.trim() === buildingName);
  return cell?.closest("tr")!;
};


const getHistoricModal = () =>
  screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;

const getBuildingFilter = () =>
  document.getElementById("viewer-building-filter") as HTMLSelectElement;
const getStatusFilter = () =>
  document.getElementById("viewer-status-filter") as HTMLSelectElement;
const getSeverityFilter = () =>
  document.getElementById("viewer-severity-filter") as HTMLSelectElement;
const getSearchInput = () =>
  document.getElementById("viewer-search") as HTMLInputElement;



describe("ViewerAnomalyPage", () => {

  describe("Initial render", () => {
    it("renders the Anomaly Alerts heading", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.getByRole("heading", { name: /anomaly alerts/i })).toBeInTheDocument();
    });

    it("renders the viewer subtitle", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.getByText(/view anomalies across your buildings/i)).toBeInTheDocument();
    });

    it("renders the View Historic Alerts button", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.getByRole("button", { name: /view historic alerts/i })).toBeInTheDocument();
    });

    it("does NOT render a Configure Threshold button", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.queryByRole("button", { name: /configure threshold/i })).not.toBeInTheDocument();
    });

    it("renders Sandton HQ in the anomalies table", () => {
      render(<ViewerAnomalyPage />);
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
    });

    it("renders College in the anomalies table", () => {
      render(<ViewerAnomalyPage />);
      expect(getTableCell("College")).toBeInTheDocument();
    });

    it("does not render Resolve or Ignore action buttons", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.queryByRole("button", { name: /^resolve$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^ignore$/i })).not.toBeInTheDocument();
    });

    it("does not show any modal on initial render", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Notification", () => {
    it("renders notification badge showing active anomaly count", () => {
      render(<ViewerAnomalyPage />);
      expect(screen.getByText(/2 new/i)).toBeInTheDocument();
    });
  });

  describe("stats", () => {
    it("renders Total Alerts label", () => {
      render(<ViewerAnomalyPage />);
      expect(within(getKpiSection()).getByText("Total Alerts")).toBeInTheDocument();
    });

    it("renders Open label", () => {
      render(<ViewerAnomalyPage />);
      expect(within(getKpiSection()).getByText("Open")).toBeInTheDocument();
    });

    it("renders Critical label", () => {
      render(<ViewerAnomalyPage />);
      expect(within(getKpiSection()).getByText("Critical")).toBeInTheDocument();
    });

    it("renders Critical count", () => {
      render(<ViewerAnomalyPage />);
      expect(within(getKpiSection()).getByText("1")).toBeInTheDocument();
    });

    it("renders Buildings label", () => {
      render(<ViewerAnomalyPage />);
      expect(within(getKpiSection()).getByText("Buildings")).toBeInTheDocument();
    });
  });

  describe("Reset button", () => {
    it("resets building filter to all", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getBuildingFilter(), { target: { value: "b1" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getBuildingFilter().value).toBe("all");
    });

    it("resets status filter to all", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getStatusFilter(), { target: { value: "Open" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getStatusFilter().value).toBe("all");
    });

    it("resets severity filter to all", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSeverityFilter(), { target: { value: "high" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getSeverityFilter().value).toBe("all");
    });

    it("clears the search input", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSearchInput(), { target: { value: "Power" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getSearchInput().value).toBe("");
    });

    it("restores all anomalies after reset", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getBuildingFilter(), { target: { value: "b1" } });
      expect(getTableCell("College")).toBeUndefined();
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getTableCell("College")).toBeInTheDocument();
    });
  });

  describe("Building filter", () => {
    it("filters to show only Sandton HQ in the table", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getBuildingFilter(), { target: { value: "b1" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("College")).toBeUndefined();
    });

    it("shows No anomalies found when filter matches nothing", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getBuildingFilter(), { target: { value: "b999" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Status filter", () => {
    it("filters to show only Open anomalies", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getStatusFilter(), { target: { value: "Open" } });
      expect(getTableCell("College")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });

    it("filters to show only In Progress anomalies", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getStatusFilter(), { target: { value: "In_Progress" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("College")).toBeUndefined();
    });

    it("shows No anomalies found when filtered status has no matches", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getStatusFilter(), { target: { value: "Resolved" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Severity filter", () => {
    it("filters to show only critical anomalies", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSeverityFilter(), { target: { value: "critical" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("College")).toBeUndefined();
    });

    it("filters to show only high severity anomalies", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSeverityFilter(), { target: { value: "high" } });
      expect(getTableCell("College")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });
  });

  describe("Search input", () => {
    it("filters by description", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSearchInput(), { target: { value: "High power spike" } });
      expect(getTableCell("College")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });

    it("filters by building name", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSearchInput(), { target: { value: "Sandton" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("College")).toBeUndefined();
    });

    it("shows No anomalies found when search matches nothing", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.change(getSearchInput(), { target: { value: "zzznomatch" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Row click", () => {
    it("opens the details modal when a row is clicked", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      expect(screen.getByRole("heading", { name: /anomaly details/i })).toBeInTheDocument();
    });

    it("modal shows the building name", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText("Sandton HQ")).toBeInTheDocument();
    });

    it("modal shows anomaly description", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText(/critical power spike detected/i)).toBeInTheDocument();
    });

    it("modal shows threshold details", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText(/threshold details/i)).toBeInTheDocument();
    });

    it("modal does NOT have an Edit Threshold button", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).queryByRole("button", { name: /edit threshold/i })).not.toBeInTheDocument();
    });

    it("modal has a Close button", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
    });
  });

  describe("Close button details modal", () => {
    it("closes the details modal", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("heading", { name: /anomaly details/i })).not.toBeInTheDocument();
    });
  });

  describe("View Historic Alerts button", () => {
    it("opens the historic alerts modal", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(screen.getByRole("heading", { name: /historic alerts/i })).toBeInTheDocument();
    });

    it("historic modal shows Azalea res", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
     
      const modal = getHistoricModal();
      const cells = within(modal as HTMLElement).getAllByRole("cell");
      expect(cells.find((c) => c.textContent?.trim() === "Azalea res")).toBeInTheDocument();
    });

    it("historic modal has status filter", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(document.getElementById("historic-status-viewer")).toBeInTheDocument();
    });

    it("historic modal has search input", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(screen.getByPlaceholderText(/search historic alerts/i)).toBeInTheDocument();
    });

    it("historic modal has Reset button", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      expect(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i })).toBeInTheDocument();
    });

    it("historic modal has Close button", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
    });

    it("closes the historic modal when Close is clicked", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("heading", { name: /historic alerts/i })).not.toBeInTheDocument();
    });

    it("historic search filters by building name", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      const searchInput = screen.getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "Hillcrest" } });
      
      const cells = within(modal as HTMLElement).getAllByRole("cell");
      expect(cells.find((c) => c.textContent?.trim() === "Hillcrest")).toBeInTheDocument();
      expect(cells.find((c) => c.textContent?.trim() === "College")).toBeUndefined();
    });

    it("historic Reset button clears search and restores all alerts", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      const searchInput = screen.getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "Hillcrest" } });
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i }));
      expect((searchInput as HTMLInputElement).value).toBe("");
      
      const cells = within(modal as HTMLElement).getAllByRole("cell");
      expect(cells.find((c) => c.textContent?.trim() === "College")).toBeInTheDocument();
    });

    it("shows No historic alerts found when filter matches nothing", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      fireEvent.change(screen.getByPlaceholderText(/search historic alerts/i), {
        target: { value: "zzznomatch" },
      });
      const modal = getHistoricModal();
      expect(within(modal as HTMLElement).getByText(/no historic alerts found/i)).toBeInTheDocument();
    });
  });
});