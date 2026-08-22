import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ViewerAnomalyPage from "./page";

jest.mock("recharts", () => ({
  
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,

  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  Scatter: () => null,
}));


const getAnomaliesSection = () => {
  return screen.getByRole("region", { name: /anomalies list/i });
};

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
    return options.some(option => option.value === "critical" || option.value === "high");
  }) as HTMLSelectElement;
};

const getSearchInput = () =>
  screen.getByRole("textbox") as HTMLInputElement;

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
      const label = findKpiLabel("Total Alerts");
      expect(label).toBeInTheDocument();
    });

    it("renders Open label", () => {
      render(<ViewerAnomalyPage />);
      const label = findKpiLabel("Open");
      expect(label).toBeInTheDocument();
    });

    it("renders Critical label", () => {
      render(<ViewerAnomalyPage />);
      const label = findKpiLabel("Critical");
      expect(label).toBeInTheDocument();
    });

    it("renders Critical count", () => {
      render(<ViewerAnomalyPage />);
      const criticalValue = screen.getAllByText("1").find(el => 
        el.closest(".dashboard-card-tight")?.querySelector(".dashboard-kpi-label")?.textContent === "Critical"
      );
      expect(criticalValue).toBeInTheDocument();
    });

    it("renders Buildings label", () => {
      render(<ViewerAnomalyPage />);
      const label = findKpiLabel("Buildings");
      expect(label).toBeInTheDocument();
    });
  });


  });


  describe("Severity filter", () => {
    it("filters to show only critical anomalies", () => {
      render(<ViewerAnomalyPage />);
      const severityFilter = getSeverityFilter();
      if (severityFilter) {
        fireEvent.change(severityFilter, { target: { value: "critical" } });
        expect(getTableCell("Sandton HQ")).toBeInTheDocument();
        expect(getTableCell("College")).toBeUndefined();
      }
    });

    it("filters to show only high severity anomalies", () => {
      render(<ViewerAnomalyPage />);
      const severityFilter = getSeverityFilter();
      if (severityFilter) {
        fireEvent.change(severityFilter, { target: { value: "high" } });
        expect(getTableCell("College")).toBeInTheDocument();
        expect(getTableCell("Sandton HQ")).toBeUndefined();
      }
    });
  });

  describe("Search input", () => {
    it("filters by description", () => {
      render(<ViewerAnomalyPage />);
      const searchInput = getSearchInput();
      fireEvent.change(searchInput, { target: { value: "High power spike" } });
      expect(getTableCell("College")).toBeInTheDocument();
      expect(getTableCell("Sandton HQ")).toBeUndefined();
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
      const modal = getHistoricModal();
      expect(within(modal as HTMLElement).getAllByRole("combobox").length).toBeGreaterThan(0);
    });

    it("historic modal has search input", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      expect(
        within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i)
      ).toBeInTheDocument();
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
      const searchInput = within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "Hillcrest" } });
      
      const cells = within(modal as HTMLElement).getAllByRole("cell");
      expect(cells.find((c) => c.textContent?.trim() === "Hillcrest")).toBeInTheDocument();
      expect(cells.find((c) => c.textContent?.trim() === "College")).toBeUndefined();
    });

    it("historic Reset button clears search and restores all alerts", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      const searchInput = within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "Hillcrest" } });
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^reset$/i }));
      expect((searchInput as HTMLInputElement).value).toBe("");
      
      const cells = within(modal as HTMLElement).getAllByRole("cell");
      expect(cells.find((c) => c.textContent?.trim() === "College")).toBeInTheDocument();
    });

    it("shows No historic alerts found when filter matches nothing", () => {
      render(<ViewerAnomalyPage />);
      fireEvent.click(screen.getByRole("button", { name: /view historic alerts/i }));
      const modal = getHistoricModal();
      const searchInput = within(modal as HTMLElement).getByPlaceholderText(/search historic alerts/i);
      fireEvent.change(searchInput, { target: { value: "zzznomatch" } });
      expect(within(modal as HTMLElement).getByText(/no historic alerts found/i)).toBeInTheDocument();
    });
  });
