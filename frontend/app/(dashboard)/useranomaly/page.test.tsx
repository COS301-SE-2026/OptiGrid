import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import ViewerAnomalyPage from "./page";
import "@testing-library/jest-dom";


const MOCK_ANOMALIES = [
  {
    anomaly_id: "a1",
    building_id: "b1",
    building_name: "Sandton HQ",
    anomaly_type: "POWER_USAGE",
    severity_level: "critical",
    description: "Critical power spike detected",
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
    building_name: "College",
    anomaly_type: "CURRENT_SPIKE",
    severity_level: "high",
    description: "High power spike over-consumption",
    status: "Open",
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

  {
    anomaly_id: "a3",
    building_id: "b3",
    building_name: "Azalea res",
    anomaly_type: "VOLTAGE_DROP",
    severity_level: "low",
    description: "Voltage drop detected",
    status: "Resolved",
    detected_timestamp: "2026-06-01T08:00:00Z",
    resolved_timestamp: "2026-06-02T10:00:00Z",
    resolved_by: "Admin",
    z_score_value: 2.1,
  },
  {
    anomaly_id: "a4",
    building_id: "b4",
    building_name: "Hillcrest",
    anomaly_type: "PHASE_IMBALANCE",
    severity_level: "medium",
    description: "Phase imbalance detected",
    status: "Resolved",
    detected_timestamp: "2026-05-20T14:00:00Z",
    resolved_timestamp: "2026-05-21T09:00:00Z",
    resolved_by: "Admin",
    z_score_value: 2.5,
  },
  {
    anomaly_id: "a5",
    building_id: "b2",
    building_name: "College",
    anomaly_type: "POWER_USAGE",
    severity_level: "low",
    description: "Minor power fluctuation",
    status: "Ignored",
    detected_timestamp: "2026-05-10T11:00:00Z",
    resolved_timestamp: "2026-05-10T12:00:00Z",
    resolved_by: "Admin",
    z_score_value: 2.0,
  },
];

const MOCK_BUILDINGS = [
  { id: "b1", name: "Sandton HQ" },
  { id: "b2", name: "College" },
  { id: "b3", name: "Azalea res" },
  { id: "b4", name: "Hillcrest" },
];


jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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


beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn((url: string) => {
    if (url.includes("/api/anomalies/portfolio")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: MOCK_ANOMALIES }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});





async function renderPage() {
  render(<ViewerAnomalyPage />);
  await act(async () => {
    await Promise.resolve();
  });
}

const getAnomaliesSection = () =>
  screen.getByRole("region", { name: /anomalies list/i });

const getTableCell = (text: string) => {
  const section = getAnomaliesSection();
  const cells = within(section).getAllByRole("cell");
  return cells.find((cell) => cell.textContent?.trim() === text);
};

const getTableRow = (buildingName: string) => {
  const section = getAnomaliesSection();
  const cells = within(section).getAllByRole("cell");
  const cell = cells.find((c) => c.textContent?.trim() === buildingName);
  if (!cell) {
    throw new Error(`Could not find table cell for building: ${buildingName}`);
  }
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`Could not find table row for building: ${buildingName}`);
  }
  return row;
};

const getHistoricModal = () => {
  const heading = screen.getByRole("heading", { name: /historic alerts/i });
  return heading.closest(".modal") || heading.closest("[class*='modal']") || heading.parentElement!;
};

const getSeverityFilter = () => {
  const selects = screen.getAllByRole("combobox");
  return selects.find((select) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return options.some((option) => option.value === "critical" || option.value === "high");
  }) as HTMLSelectElement;
};

const getSearchInput = () => screen.getByRole("textbox") as HTMLInputElement;

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

describe("ViewerAnomalyPage", () => {
  describe("Initial render", () => {
    it("renders the Anomaly Alerts heading", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { name: /anomaly alerts/i })).toBeInTheDocument();
    });

    it("renders the viewer subtitle", async () => {
      await renderPage();
      expect(screen.getByText(/view anomalies across your buildings/i)).toBeInTheDocument();
    });

    it("renders the View Historic Alerts button", async () => {
      await renderPage();
      expect(screen.getByRole("button", { name: /view historic alerts/i })).toBeInTheDocument();
    });

    it("does NOT render a Configure Threshold button", async () => {
      await renderPage();
      expect(screen.queryByRole("button", { name: /configure threshold/i })).not.toBeInTheDocument();
    });

    it("renders Sandton HQ in the anomalies table", async () => {
      await renderPage();
      expect(getTableCell("Sandton HQ")).toBeInTheDocument();
    });

    it("renders College in the anomalies table", async () => {
      await renderPage();
      expect(getTableCell("College")).toBeInTheDocument();
    });

    it("does not render Resolve or Ignore action buttons", async () => {
      await renderPage();
      expect(screen.queryByRole("button", { name: /^resolve$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^ignore$/i })).not.toBeInTheDocument();
    });

    it("does not show any modal on initial render", async () => {
      await renderPage();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Notification", () => {
    it("renders notification badge showing active anomaly count", async () => {
      await renderPage();
      expect(screen.getByText(/2 new/i)).toBeInTheDocument();
    });
  });

  describe("stats", () => {
    it.each([
      { label: "Total Alerts", type: "label" },
      { label: "Open", type: "label" },
      { label: "Critical", type: "label" },
      { label: "Critical", type: "count", value: "1" },
      { label: "Buildings", type: "label" },
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

    describe("Severity filter", () => {
      it("filters to show only critical anomalies", async () => {
        await renderPage();
        const severityFilterEl = getSeverityFilter();
        if (severityFilterEl) {
          fireEvent.change(severityFilterEl, { target: { value: "critical" } });
          expect(getTableCell("Sandton HQ")).toBeInTheDocument();
          expect(getTableCell("College")).toBeUndefined();
        }
      });

      it("filters to show only high severity anomalies", async () => {
        await renderPage();
        const severityFilterEl = getSeverityFilter();
        if (severityFilterEl) {
          fireEvent.change(severityFilterEl, { target: { value: "high" } });
          expect(getTableCell("College")).toBeInTheDocument();
          expect(getTableCell("Sandton HQ")).toBeUndefined();
        }
      });
    });

    describe("Search input", () => {
      it("filters by description", async () => {
        await renderPage();
        const searchInput = getSearchInput();
        fireEvent.change(searchInput, { target: { value: "High power spike" } });
        expect(getTableCell("College")).toBeInTheDocument();
        expect(getTableCell("Sandton HQ")).toBeUndefined();
      });
    });

    describe("Row click", () => {
      it("opens the details modal when a row is clicked", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        expect(screen.getByRole("heading", { name: /anomaly details/i })).toBeInTheDocument();
      });

      it("modal shows the building name", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
        expect(within(modal as HTMLElement).getByText("Sandton HQ")).toBeInTheDocument();
      });

      it("modal shows anomaly description", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
        expect(within(modal as HTMLElement).getByText(/critical power spike detected/i)).toBeInTheDocument();
      });

      it("modal shows threshold details", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
        expect(within(modal as HTMLElement).getByText(/threshold details/i)).toBeInTheDocument();
      });

      it("modal does NOT have an Edit Threshold button", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
        expect(within(modal as HTMLElement).queryByRole("button", { name: /edit threshold/i })).not.toBeInTheDocument();
      });

      it("modal has a Close button", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
        expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
      });
    });

    describe("Close button details modal", () => {
      it("closes the details modal", async () => {
        await renderPage();
        fireEvent.click(getTableRow("Sandton HQ"));
        const modal = screen.getByRole("heading", { name: /anomaly details/i }).closest(".modal")!;
        fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
        expect(screen.queryByRole("heading", { name: /anomaly details/i })).not.toBeInTheDocument();
      });
    });

    describe("View Historic Alerts button", () => {
      it("opens the historic alerts modal", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        expect(screen.getByRole("heading", { name: /historic alerts/i })).toBeInTheDocument();
      });

      it("historic modal shows Azalea res", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        const cells = within(modal as HTMLElement).getAllByRole("cell");
        expect(cells.find((c) => c.textContent?.trim() === "Azalea res")).toBeInTheDocument();
      });

      it("historic modal has status filter", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        expect(within(modal as HTMLElement).getAllByRole("combobox").length).toBeGreaterThan(0);
      });

      it("historic modal has search input", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        expect(within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i)).toBeInTheDocument();
      });

      it("historic modal has Reset button", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        expect(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i })).toBeInTheDocument();
      });

      it("historic modal has Close button", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        expect(within(modal as HTMLElement).getByRole("button", { name: /close/i })).toBeInTheDocument();
      });

      it("closes the historic modal when Close is clicked", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /close/i }));
        expect(screen.queryByRole("heading", { name: /historic alerts/i })).not.toBeInTheDocument();
      });

      it("historic search filters by building name", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        const searchInput = within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i);
        fireEvent.change(searchInput, { target: { value: "Hillcrest" } });

        const cells = within(modal as HTMLElement).getAllByRole("cell");
        expect(cells.find((c) => c.textContent?.trim() === "Hillcrest")).toBeInTheDocument();
        expect(cells.find((c) => c.textContent?.trim() === "College")).toBeUndefined();
      });

      it("historic Reset button clears search and restores all alerts", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        const searchInput = within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i);
        fireEvent.change(searchInput, { target: { value: "Hillcrest" } });
        fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i }));
        expect((searchInput as HTMLInputElement).value).toBe("");

        const cells = within(modal as HTMLElement).getAllByRole("cell");
        expect(cells.find((c) => c.textContent?.trim() === "College")).toBeInTheDocument();
      });

      it("shows No historic alerts found when filter matches nothing", async () => {
        await renderPage();
        fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
        const modal = getHistoricModal();
        const searchInput = within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i);
        fireEvent.change(searchInput, { target: { value: "zzznomatch" } });
        expect(within(modal as HTMLElement).getByText(/no historic alerts found/i)).toBeInTheDocument();
      });
    });
  });
});