import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import ManagerAnomalyPage from "./page";
import "@testing-library/jest-dom";


const MOCK_ANOMALIES = [
  {
    anomaly_id: "a1",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "POWER_USAGE",
    severity_level: "critical",
    description: "Sudden power spike detected",
    status: "Open",
    detected_timestamp: new Date().toISOString(),
    resolved_timestamp: null,
    resolved_by: null,
    z_score_value: 4.2,
    threshold_details: {
      threshold_id: "t1",
      z_score_threshold: 3.0,
      metric_type: "power",
      unit: "kW",
      is_active: true,
    },
  },
  {
    anomaly_id: "a2",
    building_id: "b2",
    building_name: "Hillcrest",
    anomaly_type: "CURRENT_SPIKE",
    severity_level: "high",
    description: "Energy over-consumption anomaly",
    status: "In_Progress",
    detected_timestamp: new Date().toISOString(),
    resolved_timestamp: null,
    resolved_by: null,
    z_score_value: 3.1,
    threshold_details: {
      threshold_id: "t2",
      z_score_threshold: 2.5,
      metric_type: "power",
      unit: "kW",
      is_active: true,
    },
  },
];

const MOCK_THRESHOLDS = [
  {
    threshold_id: "t1",
    building_id: "b1",
    building_name: "Sandton HQ",
    metric_type: "power",
    unit: "kW",
    z_score_threshold: 3.0,
    is_active: true,
  },
];

const MOCK_BUILDINGS = [
  { id: "b1", name: "Sandton HQ" },
  { id: "b2", name: "Hillcrest" },
];


jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Scatter: () => null,
}));

jest.mock("@/lib/useBuildings", () => ({
  useBuildings: () => ({ data: MOCK_BUILDINGS, isLoading: false, error: null }),
}));


beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
    if (url.includes("/api/anomalies/portfolio")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: MOCK_ANOMALIES }),
      });
    }
    if (url.includes("/api/thresholds/portfolio")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: MOCK_THRESHOLDS }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});





async function renderPage() {
  render(<ManagerAnomalyPage />);

  await act(async () => {
    await Promise.resolve();
  });
}

const getAnomaliesSection = () =>
  screen.getByRole("region", { name: /anomalies list/i });

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
  const cards = document.querySelectorAll(".dashboard-card-tight");
  for (const card of cards) {
    const label = card.querySelector(".dashboard-kpi-label");
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
    it("renders the Anomaly Alerts heading", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { name: /anomaly alerts/i })).toBeInTheDocument();
    });

    it("renders the subtitle", async () => {
      await renderPage();
      expect(screen.getByText(/manage anomalies across your assigned buildings/i)).toBeInTheDocument();
    });

    it("renders the Configure Threshold button", async () => {
      await renderPage();
      expect(screen.getByRole("button", { name: /configure threshold/i })).toBeInTheDocument();
    });

    it("renders the View Historic Alerts button", async () => {
      await renderPage();
      expect(screen.getByRole("button", { name: /view historic alerts/i })).toBeInTheDocument();
    });

    it("renders Sandton HQ in the anomalies table", async () => {
      await renderPage();
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
    });

    it("renders Hillcrest in the anomalies table", async () => {
      await renderPage();
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
    });

    it("does not show any modal", async () => {
      await renderPage();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("stats", () => {
    it.each([
      { label: "Total Alerts", type: "label" },
      { label: "Open", type: "label" },
      { label: "Critical", type: "label" },
      { label: "Buildings", type: "label" },
      { label: "Total Alerts", type: "count", value: "2" },
      { label: "Critical", type: "count", value: "1" },
    ])("renders $label $type", async ({ label, type, value }) => {
      await renderPage();

      if (type === "label") {
        expect(findKpiLabel(label)).toBeInTheDocument();
        return;
      }

      const valueElement = screen.getAllByText(value!).find(
        (el) =>
          el
            .closest(".dashboard-card-tight")
            ?.querySelector(".dashboard-kpi-label")
            ?.textContent === label
      );

      expect(valueElement).toBeInTheDocument();
    });
  });

  describe("Critical notifications", () => {
    it("renders notification alert for critical open anomaly", async () => {
      await renderPage();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("notification shows the building name", async () => {
      await renderPage();
      const alert = screen.getByRole("alert");
      expect(within(alert).getByText("Sandton HQ")).toBeInTheDocument();
    });

    it("dismiss button closes the notification", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /dismiss notification/i }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("Reset button", () => {
    it.each([
      { name: "building", getFilter: getBuildingFilter, value: "b1" },
      { name: "status", getFilter: getStatusFilter, value: "Open" },
      { name: "severity", getFilter: getSeverityFilter, value: "critical" },
    ])("resets $name filter to all", async ({ getFilter, value }) => {
      await renderPage();
      const filter = getFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(filter.value).toBe("all");
    });

    it("clears search query", async () => {
      await renderPage();
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "spike" } });
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(searchInput.value).toBe("");
    });

    it("restores all anomalies after reset", async () => {
      await renderPage();
      const filter = getBuildingFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "b1" } });
      expect(getTableCell("Hillcrest")).toBeUndefined();
      fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
    });
  });

  describe("Building filter", () => {
    it("shows No anomalies found when filter matches nothing", async () => {
      await renderPage();
      const filter = getBuildingFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value: "b999" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Single-filter", () => {
    it.each([
      { label: "Building filter shows only Sandton HQ", getFilter: getBuildingFilter, value: "b1", expected: "Sandton HQ", unexpected: "Hillcrest" },
      { label: "Status filter shows only Open anomalies", getFilter: getStatusFilter, value: "Open", expected: "Sandton HQ", unexpected: "Hillcrest" },
      { label: "Status filter shows only In Progress anomalies", getFilter: getStatusFilter, value: "In_Progress", expected: "Hillcrest", unexpected: "Sandton HQ" },
      { label: "Severity filter shows only critical anomalies", getFilter: getSeverityFilter, value: "critical", expected: "Sandton HQ", unexpected: "Hillcrest" },
      { label: "Severity filter shows only high severity anomalies", getFilter: getSeverityFilter, value: "high", expected: "Hillcrest", unexpected: "Sandton HQ" },
    ])("$label", async ({ getFilter, value, expected, unexpected }) => {
      await renderPage();
      const filter = getFilter();
      expect(filter).not.toBeNull();
      fireEvent.change(filter, { target: { value } });
      expect(getTableCell(expected)).toBeInTheDocument();
      expect(getTableCell(unexpected)).toBeUndefined();
    });
  });

  describe("Search input", () => {
    it("filters by anomaly type", async () => {
      await renderPage();
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "CURRENT" } });
      expect(getTableCell("Hillcrest")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
    });

    it("filters by building name", async () => {
      await renderPage();
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "Sandton" } });
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
      expect(getTableCell("Hillcrest")).toBeUndefined();
    });

    it("shows No anomalies found when search matches nothing", async () => {
      await renderPage();
      const searchInput = getSearchInput();
      expect(searchInput).not.toBeNull();
      fireEvent.change(searchInput, { target: { value: "zzznomatch" } });
      expect(within(getAnomaliesSection()).getByText(/no anomalies found/i)).toBeInTheDocument();
    });
  });

  describe("Row click", () => {
    it("opens details modal when row is clicked", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      expect(screen.getByRole("heading", { name: /anomaly details/i })).toBeInTheDocument();
    });

    it("modal shows building name", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText("Sandton HQ")).toBeInTheDocument();
    });

    it("modal shows anomaly description", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByText(/sudden power spike detected/i)).toBeInTheDocument();
    });

    it("modal has a Close button", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
    });
  });

  describe("Close button", () => {
    it("closes the details modal", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("heading", { name: /anomaly details/i })).not.toBeInTheDocument();
    });
  });

  describe("Resolve button", () => {
    it("renders Resolve button in details modal", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /resolve/i })).toBeInTheDocument();
    });

    it("opens the resolve confirmation modal", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /resolve/i }));
      expect(screen.getByRole("heading", { name: /resolve anomaly/i })).toBeInTheDocument();
    });

    it("resolve modal has Cancel button", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("resolve modal has Resolve confirm button", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /^resolve$/i })).toBeInTheDocument();
    });
  });

  describe("Resolve confirm button", () => {
    const resolveAnomaly = async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      await act(async () => {
        fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^resolve$/i }));
        await Promise.resolve();
      });
    };

    it("changes anomaly status to Resolved", async () => {
      await resolveAnomaly();
      expect(within(getTableRow("Sandton HQ")).getByText("Resolved")).toBeInTheDocument();
    });

    it("closes the resolve modal after confirming", async () => {
      await resolveAnomaly();
      expect(screen.queryByRole("heading", { name: /resolve anomaly/i })).not.toBeInTheDocument();
    });
  });

  describe("Cancel button in resolve modal", () => {
    it("closes resolve modal without changing status", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /resolve/i }));
      const modal = screen.getByRole("heading", { name: /resolve anomaly/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /resolve anomaly/i })).not.toBeInTheDocument();
      expect(within(getTableRow("Sandton HQ")).getByText("Open")).toBeInTheDocument();
    });
  });

  describe("Ignore button", () => {
    it("renders Ignore button in details modal", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /ignore/i })).toBeInTheDocument();
    });

    it("opens the ignore confirmation modal", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /ignore/i }));
      expect(screen.getByRole("heading", { name: /ignore anomaly/i })).toBeInTheDocument();
    });

    it("ignore modal has Ignore confirm button", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /ignore/i }));
      const modal = screen.getByRole("heading", { name: /ignore anomaly/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /^ignore$/i })).toBeInTheDocument();
    });
  });

  describe("Ignore confirm button", () => {
    const ignoreAnomaly = async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /ignore/i }));
      const modal = screen.getByRole("heading", { name: /ignore anomaly/i }).closest(".modal")!;
      await act(async () => {
        fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^ignore$/i }));
        await Promise.resolve();
      });
    };

    it("changes anomaly status to Ignored", async () => {
      await ignoreAnomaly();
      expect(within(getTableRow("Sandton HQ")).getByText("Ignored")).toBeInTheDocument();
    });

    it("closes the ignore modal after confirming", async () => {
      await ignoreAnomaly();
      expect(screen.queryByRole("heading", { name: /ignore anomaly/i })).not.toBeInTheDocument();
    });
  });

  describe("Cancel button in ignore modal", () => {
    it("closes ignore modal without changing status", async () => {
      await renderPage();
      fireEvent.click(getTableRow("Sandton HQ"));
      const detailsModal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
      fireEvent.click(within(detailsModal as HTMLElement).getByRole("button", { name: /ignore/i }));
      const modal = screen.getByRole("heading", { name: /ignore anomaly/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /ignore anomaly/i })).not.toBeInTheDocument();
      expect(within(getTableRow("Sandton HQ")).getByText("Open")).toBeInTheDocument();
    });
  });

  describe("Configure Threshold button", () => {
    it("opens the threshold modal", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      expect(screen.getByRole("heading", { name: /configure alert threshold/i })).toBeInTheDocument();
    });

    it.each([
      { label: "building select", id: "threshold-building" },
      { label: "upper limit input", id: "upper-limit" },
      { label: "lower limit input", id: "lower-limit" },
      { label: "spike percentage input", id: "spike-percentage" },
    ])("threshold modal has $label", async ({ id }) => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      expect(document.getElementById(id)).toBeInTheDocument();
    });

    it("threshold modal has Save Threshold button", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      expect(screen.getByRole("button", { name: /save threshold/i })).toBeInTheDocument();
    });

    it("threshold modal has Cancel button", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      const modal = screen.getByRole("heading", { name: /configure alert threshold/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe("Save Threshold button", () => {
    it("closes the threshold modal after saving", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      fireEvent.click(screen.getByRole("button", { name: /save threshold/i }));
      expect(screen.queryByRole("heading", { name: /configure alert threshold/i })).not.toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    it("closes the threshold modal without saving", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /configure threshold/i }));
      const modal = screen.getByRole("heading", { name: /configure alert threshold/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /configure alert threshold/i })).not.toBeInTheDocument();
    });
  });

  describe("View Historic Alerts button", () => {
    it("opens the historic alerts modal", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(screen.getByRole("heading", { name: /historic alerts/i })).toBeInTheDocument();
    });

    it("historic modal has status filter", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(document.getElementById("historic-status-manager")).toBeInTheDocument();
    });

    it("historic modal has search input", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      expect(screen.getByPlaceholderText(/search historic alerts/i)).toBeInTheDocument();
    });

    it("historic modal has Close button", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
    });

    it("closes the historic modal when Close is clicked", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("heading", { name: /historic alerts/i })).not.toBeInTheDocument();
    });

    it("historic Reset button clears search", async () => {
      await renderPage();
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = screen.getByRole("heading", { name: /historic alerts/i }).closest(".modal")!;
      const searchInput = screen.getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "Voltage" } });

      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i }));
      expect((searchInput as HTMLInputElement).value).toBe("");
    });
  });
});