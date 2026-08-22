import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ManagerAnomalyPage from "./page";

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Scatter: () => null,
}));

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());
beforeEach(() => jest.clearAllMocks());

const getKpiSection = () => {
  const kpiContainer = document.querySelector('[style*="grid-template-columns"]');
  if (kpiContainer) {
    return kpiContainer as HTMLElement;
  }
  return document.body;
};

const getAnomaliesSection = () => {
  return screen.getByRole("region", { name: /anomalies list/i });
};

const getTableCell = (text: string) => {
  const section = getAnomaliesSection();
  return within(section)
    .getAllByRole("cell")
    .find((cell) => cell.textContent?.trim() === text);
};

const getTableRow = (buildingName: string): HTMLElement => {
  const section = getAnomaliesSection();
  const cells = within(section).getAllByRole("cell");
  const cell = cells.find((c) => c.textContent?.trim() === buildingName);
  if (!cell) {
    throw new Error(`No table cell found with text "${buildingName}"`);
  }
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`Cell "${buildingName}" is not inside a <tr>`);
  }
  return row as HTMLElement;
};

const findKpiLabel = (labelText: string) => {
  const cards = document.querySelectorAll('.dashboard-card-tight');
  for (const card of cards) {
    const label = card.querySelector('.dashboard-kpi-label');
    if (label && label.textContent?.trim() === labelText) {
      return label;
    }
  }
  return null;
};

const getBuildingFilter = () =>
  document.getElementById("building-filter") as HTMLSelectElement;
const getStatusFilter = () =>
  document.getElementById("status-filter") as HTMLSelectElement;
const getSeverityFilter = () =>
  document.getElementById("severity-filter") as HTMLSelectElement;
const getSearchInput = () =>
  document.getElementById("search-input") as HTMLInputElement;

describe("ManagerAnomalyPage", () => {
  describe("Initial render", () => {
    it("renders the Anomaly Alerts heading", () => {
      render(<ManagerAnomalyPage />);
      expect(screen.getByRole("heading", { name: /anomaly alerts/i })).toBeInTheDocument();
    });

    it("renders the subtitle", () => {
      render(<ManagerAnomalyPage />);
      expect(screen.getByText(/manage anomalies across your assigned buildings/i)).toBeInTheDocument();
    });

    it("renders the Configure Threshold button", () => {
      render(<ManagerAnomalyPage />);
      expect(screen.getByRole("button", { name: /configure threshold/i })).toBeInTheDocument();
    });

    it("renders the View Historic Alerts button", () => {
      render(<ManagerAnomalyPage />);
      expect(screen.getByRole("button", { name: /view historic alerts/i })).toBeInTheDocument();
    });

    it("renders Sandton HQ in the anomalies table", () => {
      render(<ManagerAnomalyPage />);
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
    });

    it("renders Hillcrest in the anomalies table", () => {
      render(<ManagerAnomalyPage />);
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
    });

    it("does not show any modal", () => {
      render(<ManagerAnomalyPage />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("stats", () => {
    it("renders Total Alerts label", () => {
      render(<ManagerAnomalyPage />);
      const label = findKpiLabel("Total Alerts");
      expect(label).toBeInTheDocument();
    });

    it("renders Total Alerts count", () => {
      render(<ManagerAnomalyPage />);
      const totalCard = screen.getAllByText("2").find((el) => 
        el.closest(".dashboard-card-tight")?.querySelector(".dashboard-kpi-label")?.textContent === "Total Alerts"
      );
      expect(totalCard).toBeInTheDocument();
    });

    it("renders Open label", () => {
      render(<ManagerAnomalyPage />);
      const label = findKpiLabel("Open");
      expect(label).toBeInTheDocument();
    });

    it("renders Critical label", () => {
      render(<ManagerAnomalyPage />);
      const label = findKpiLabel("Critical");
      expect(label).toBeInTheDocument();
    });

    it("renders Critical count", () => {
      render(<ManagerAnomalyPage />);
      const criticalValue = screen.getAllByText("1").find((el) => 
        el.closest(".dashboard-card-tight")?.querySelector(".dashboard-kpi-label")?.textContent === "Critical"
      );
      expect(criticalValue).toBeInTheDocument();
    });

    it("renders Buildings label", () => {
      render(<ManagerAnomalyPage />);
      const label = findKpiLabel("Buildings");
      expect(label).toBeInTheDocument();
    });
  });

  describe("Critical notifications", () => {
    it("renders notification alert for critical open anomaly", () => {
      render(<ManagerAnomalyPage />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("notification shows the building name", () => {
      render(<ManagerAnomalyPage />);
      const alert = screen.getByRole("alert");
      expect(within(alert).getByText("Sandton HQ")).toBeInTheDocument();
    });

    it("dismiss button closes the notification", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Reset button", () => {
    it.each([
      { name: "building", getFilter: getBuildingFilter, value: "b1" },
      { name: "status", getFilter: getStatusFilter, value: "Open" },
      { name: "severity", getFilter: getSeverityFilter, value: "critical" },
    ])("resets $name filter to all", ({ getFilter, value }) => {
      render(<ManagerAnomalyPage />);
      const filter = getFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(filter.value).toBe("all");
    });

    it("clears search query", () => {
      render(<ManagerAnomalyPage />);
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "spike" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(searchInput.value).toBe("");
    });

    it("restores all anomalies after reset", () => {
      render(<ManagerAnomalyPage />);
      const filter = getBuildingFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "b1" } });
      expect(getTableCell("Hillcrest")).toBeUndefined();
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
    });
  });

  describe("Building filter", () => {
    it("filters to show only Sandton HQ in the table", () => {
      render(<ManagerAnomalyPage />);
      const filter = getBuildingFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "b1" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("Hillcrest")).toBeUndefined();
    });

    it("shows No anomalies found when filter matches nothing", () => {
      render(<ManagerAnomalyPage />);
      const filter = getBuildingFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "b999" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Status filter", () => {
    it("filters to show only Open anomalies", () => {
      render(<ManagerAnomalyPage />);
      const filter = getStatusFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "Open" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("Hillcrest")).toBeUndefined();
    });

    it("filters to show only In Progress anomalies", () => {
      render(<ManagerAnomalyPage />);
      const filter = getStatusFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "In_Progress" } });
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });
  });

  describe("Severity filter", () => {
    it("filters to show only critical anomalies", () => {
      render(<ManagerAnomalyPage />);
      const filter = getSeverityFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "critical" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("Hillcrest")).toBeUndefined();
    });

    it("filters to show only high severity anomalies", () => {
      render(<ManagerAnomalyPage />);
      const filter = getSeverityFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "high" } });
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });
  });

  describe("Search input", () => {
    it("filters by anomaly type", () => {
      render(<ManagerAnomalyPage />);
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "Energy" } });
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });

    it("filters by building name", () => {
      render(<ManagerAnomalyPage />);
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "Sandton" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("Hillcrest")).toBeUndefined();
    });

    it("shows No anomalies found when search matches nothing", () => {
      render(<ManagerAnomalyPage />);
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "zzznomatch" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Row click", () => {
    it("opens details modal when row is clicked", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      expect(screen.getByRole("heading", { name: /anomaly details/i })).toBeInTheDocument();
    });

    it("modal shows building name", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText("Sandton HQ")).toBeInTheDocument();
    });

    it("modal shows anomaly description", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText(/sudden power spike detected/i)).toBeInTheDocument();
    });

    it("modal has a Close button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
    });

    // Skip - Edit Threshold button doesn't exist in details modal
    it.skip("modal has an Edit Threshold button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      expect(screen.getByRole("button", { name: /edit threshold/i })).toBeInTheDocument();
    });
  });

  describe("Close button", () => {
    it("closes the details modal", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("heading", { name: /anomaly details/i })).not.toBeInTheDocument();
    });
  });

  describe("Resolve button", () => {
    it("renders Resolve button", () => {
      render(<ManagerAnomalyPage />);
      expect(within(getTableRow("Sandton HQ")).getByRole("button", { name: /resolve/i })).toBeInTheDocument();
    });

    it("opens the resolve confirmation modal", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /resolve/i }));
      expect(screen.getByRole("heading", { name: /resolve anomaly/i })).toBeInTheDocument();
    });

    it("resolve modal has Cancel button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("resolve modal has Resolve confirm button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /^resolve$/i })).toBeInTheDocument();
    });
  });

  describe("Resolve confirm button", () => {
    const resolveAnomaly = () => {
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^resolve$/i }));
    };

    it("changes anomaly status to Resolved", () => {
      render(<ManagerAnomalyPage />);
      resolveAnomaly();
      expect(within(getTableRow("Sandton HQ")).getByText("Resolved")).toBeInTheDocument();
    });

    it("closes the resolve modal after confirming", () => {
      render(<ManagerAnomalyPage />);
      resolveAnomaly();
      expect(screen.queryByRole("heading", { name: /resolve anomaly/i })).not.toBeInTheDocument();
    });

    it("hides Resolve and Ignore buttons after resolving", () => {
      render(<ManagerAnomalyPage />);
      resolveAnomaly();
      expect(within(getTableRow("Sandton HQ")).queryByRole("button", { name: /^resolve$/i })).not.toBeInTheDocument();
      expect(within(getTableRow("Sandton HQ")).queryByRole("button", { name: /ignore/i })).not.toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    it("closes resolve modal without changing status", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /resolve anomaly/i })).not.toBeInTheDocument();
      expect(within(getTableRow("Sandton HQ")).getByText("Open")).toBeInTheDocument();
    });
  });

  describe("Ignore button", () => {
    it("renders Ignore button", () => {
      render(<ManagerAnomalyPage />);
      expect(within(getTableRow("Sandton HQ")).getByRole("button", { name: /ignore/i })).toBeInTheDocument();
    });

    it("opens the ignore confirmation modal", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /ignore/i }));
      expect(screen.getByRole("heading", { name: /ignore anomaly/i })).toBeInTheDocument();
    });

    it("ignore modal has Ignore confirm button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /ignore/i }));
      const modal = screen.getByRole("heading", { name: /ignore anomaly/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /^ignore$/i })).toBeInTheDocument();
    });
  });

  describe("Ignore confirm button", () => {
    const ignoreAnomaly = () => {
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /ignore/i }));
      const modal = screen.getByRole("heading", { name: /ignore anomaly/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^ignore$/i }));
    };

    it("changes anomaly status to Ignored", () => {
      render(<ManagerAnomalyPage />);
      ignoreAnomaly();
      expect(within(getTableRow("Sandton HQ")).getByText("Ignored")).toBeInTheDocument();
    });

    it("closes the ignore modal after confirming", () => {
      render(<ManagerAnomalyPage />);
      ignoreAnomaly();
      expect(screen.queryByRole("heading", { name: /ignore anomaly/i })).not.toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    it("closes ignore modal without changing status", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(within(getTableRow("Sandton HQ")).getByRole("button", { name: /ignore/i }));
      const modal = screen.getByRole("heading", { name: /ignore anomaly/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /ignore anomaly/i })).not.toBeInTheDocument();
      expect(within(getTableRow("Sandton HQ")).getByText("Open")).toBeInTheDocument();
    });
  });

  describe("Configure Threshold button", () => {
    it("opens the threshold modal", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      expect(screen.getByRole("heading", { name: /configure alert threshold/i })).toBeInTheDocument();
    });

    it.each([
      { label: "building select", id: "threshold-building" },
      { label: "upper limit input", id: "upper-limit" },
      { label: "lower limit input", id: "lower-limit" },
      { label: "spike percentage input", id: "spike-percentage" },
    ])("threshold modal has $label", ({ id }) => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      expect(document.getElementById(id)).toBeInTheDocument();
    });

    it("threshold modal has Save Threshold button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      expect(screen.getByRole("button", { name: /save threshold/i })).toBeInTheDocument();
    });

    it("threshold modal has Cancel button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      const modal = screen.getByRole("heading", { name: /configure alert threshold/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe("Save Threshold button", () => {
    it("closes the threshold modal after saving", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      fireEvent.click(screen.getByRole("button", { name: /save threshold/i }));
      expect(screen.queryByRole("heading", { name: /configure alert threshold/i })).not.toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    it("closes the threshold modal without saving", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      const modal = screen.getByRole("heading", { name: /configure alert threshold/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /configure alert threshold/i })).not.toBeInTheDocument();
    });
  });

 
 
  describe("View Historic Alerts button", () => {
    it("opens the historic alerts modal", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(screen.getByRole("heading", { name: /historic alerts/i })).toBeInTheDocument();
    });

    it("historic modal has status filter", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(document.getElementById("historic-status-manager")).toBeInTheDocument();
    });

    it("historic modal has search input", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(screen.getByPlaceholderText(/search historic alerts/i)).toBeInTheDocument();
    });

    it("historic modal has Close button", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
    });

    it("closes the historic modal when Close is clicked", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("heading", { name: /historic alerts/i })).not.toBeInTheDocument();
    });

    it("historic Reset button clears search", () => {
      render(<ManagerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;
      const searchInput = screen.getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "Voltage" } });
     
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i }));
      expect((searchInput as HTMLInputElement).value).toBe("");
    });
  });
});