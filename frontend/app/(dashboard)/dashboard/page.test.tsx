import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import DashboardPage from "./page";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick, ...rest }: any) => (
    <a href={href} onClick={onClick} {...rest}>{children}</a>
  ),
}));

jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

jest.mock("../../../lib/session", () => ({
  buildDisplayName: (user: any) =>
    [user.firstName, user.lastName].filter(Boolean).join(" "),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderPage = () => render(<DashboardPage />, { wrapper: createWrapper() });

const mockSession = {
  user: { firstName: "Tali", lastName: "Seaba", roleType: "admin", email: "tali@example.com" },
};

const mockBuildings = {
  data: [
    {
      building_id: "b1",
      building_name: "Tower A",
      physical_address: "1 Main St",
      building_type: "Commercial",
      timezone: "Africa/Johannesburg",
      square_footage: 5000,
      max_occupancy: 200,
      today_kwh: 120,
      status: "Normal",
    },
    {
      building_id: "b2",
      building_name: "Tower B",
      physical_address: "2 Side Ave",
      building_type: "Industrial",
      timezone: "UTC",
      square_footage: 3000,
      max_occupancy: 100,
      today_kwh: 0,
      status: "Offline",
    },
  ],
};

const mockPortfolio = {
  data: {
    daily: [
      { date: "2025-01-01", kwh: 100, cost_zar: 200 },
      { date: "2025-01-02", kwh: 150, cost_zar: 300 },
    ],
    today_kwh_by_building: { b1: 120, b2: 0 },
    estimated_cost_zar: 500,
    active_alerts: 2,
  },
};

const setupFetch = ({
  session = mockSession,
  buildings = mockBuildings,
  portfolio = mockPortfolio,
  buildingsOk = true,
  sessionOk = true,
} = {}) => {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes("/api/auth/session")) {
      return Promise.resolve({
        ok: sessionOk,
        json: async () => session,
      });
    }
    if (url.includes("/api/buildings/portfolio-consumption")) {
      return Promise.resolve({
        ok: true,
        json: async () => portfolio,
      });
    }
    if (url.match(/\/api\/buildings\/[^/]+$/) && url.includes("DELETE")) {
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }
    if (url === "/api/buildings") {
      return Promise.resolve({
        ok: buildingsOk,
        json: async () => buildings,
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  setupFetch();
});

describe("DashboardPage", () => {
  describe("Loading state", () => {
    it("renders without crashing", () => {
      renderPage();
      expect(document.body).toBeTruthy();
    });

    it("renders the topbar area", async () => {
      renderPage();
      expect(await screen.findByText("Tali Seaba")).toBeInTheDocument();
    });

    it("renders user initials in the avatar", async () => {
      renderPage();
      expect(await screen.findByText("TS")).toBeInTheDocument();
    });
  });

  describe("Welcome heading", () => {
    it("renders welcome heading", async () => {
      renderPage();
      expect(await screen.findByRole("heading", { name: /welcome back, tali/i })).toBeInTheDocument();
    });

    it("renders the subtitle", async () => {
      renderPage();
      expect(await screen.findByText(/portfolio overview - last updated/i)).toBeInTheDocument();
    });
  });

  describe("Add building", () => {
    it("renders the Add building", async () => {
      renderPage();
      expect(await screen.findByRole("link", { name: /add building/i })).toBeInTheDocument();
    });

    it("make sure add building link points to /buildings/add", async () => {
      renderPage();
      const link = await screen.findByRole("link", { name: /add building/i });
      expect(link).toHaveAttribute("href", "/buildings/add");
    });
  });

  /*describe("KPI", () => {
    it("renders the Buildings KPI", async () => {
      renderPage();
      expect(await screen.findByText("Buildings")).toBeInTheDocument();
    });

    it("renders Today's usage KPI", async () => {
      renderPage();
      expect(await screen.findByText("Today's usage")).toBeInTheDocument();
    });

    it("renders Est. cost KPI", async () => {
      renderPage();
      expect(await screen.findByText("Est. cost")).toBeInTheDocument();
    });

    it("renders Active alerts", async () => {
      renderPage();
      expect(await screen.findByText("Active alerts")).toBeInTheDocument();
    });

    it("renders estimated cost", async () => {
      renderPage();
      expect(await screen.findByText(/R.*500/)).toBeInTheDocument();
    });
  });*/

  describe("KPI", () => {
  it.each([
    "Buildings",
    "Today's usage",
    "Est. cost",
    "Active alerts",
  ])("renders the %s KPI", async (label) => {
    renderPage();
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("renders estimated cost", async () => {
    renderPage();
    expect(await screen.findByText(/R.*500/)).toBeInTheDocument();
  });
});

  describe("Portfolio consumption", () => {
    it("renders the chart heading", async () => {
      renderPage();
      expect(await screen.findByText(/portfolio consumption, last 7 days/i)).toBeInTheDocument();
    });

    it("renders the kWh", async () => {
      renderPage();
      expect(await screen.findByText("kWh")).toBeInTheDocument();
    });

    it("renders the chart after loading", async () => {
      renderPage();
      expect(await screen.findByTestId("chart-container")).toBeInTheDocument();
    });
  });

  describe("Buildings table", () => {
    it("renders the buildings table", async () => {
      renderPage();
      expect(await screen.findByRole("table")).toBeInTheDocument();
    });

    it("renders table headers: Name, Type, Today, Status, Actions", async () => {
      renderPage();
      await screen.findByRole("columnheader", { name: /name/i });
      expect(screen.getByRole("columnheader", { name: /type/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /today/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();
    });

    /*it("renders Tower A building row", async () => {
      renderPage();
      expect(await screen.findByText("Tower A")).toBeInTheDocument();
    });

    it("renders Tower B building row", async () => {
      renderPage();
      expect(await screen.findByText("Tower B")).toBeInTheDocument();
    });

    it("renders building location", async () => {
      renderPage();
      expect(await screen.findByText("1 Main St")).toBeInTheDocument();
    });

    it("renders building type", async () => {
      renderPage();
      expect(await screen.findByText("Commercial")).toBeInTheDocument();
    });

    it("renders Normal status badge for Tower A", async () => {
      renderPage();
      expect(await screen.findByText("Normal")).toBeInTheDocument();
    });

    it("renders Offline status badge for Tower B", async () => {
      renderPage();
      expect(await screen.findByText("Offline")).toBeInTheDocument();
    });

    it("renders today kWh metric for Tower A", async () => {
      renderPage();
      expect(await screen.findByText("120")).toBeInTheDocument();
    });*/

    it.each([
  ["Tower A"],
  ["Tower B"],
  ["1 Main St"],
  ["Commercial"],
  ["Normal"],
  ["Offline"],
  ["120"],
])("renders %s", async (text) => {
  renderPage();
  expect(await screen.findByText(text)).toBeInTheDocument();
});







    it("navigates to building view when row is clicked", async () => {
      renderPage();
      await screen.findByText("Tower A");
      fireEvent.click(screen.getByText("Tower A").closest("tr")!);
      expect(mockPush).toHaveBeenCalledWith("/buildings/b1/view");
    });
  });

  describe("Edit link", () => {
    it("renders Edit link for Tower A", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      expect(within(row).getByRole("link", { name: /edit/i })).toBeInTheDocument();
    });

    it("Edit link points to /buildings/:id/edit", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      expect(within(row).getByRole("link", { name: /edit/i })).toHaveAttribute("href", "/buildings/b1/edit");
    });

    it("clicking Edit link does not navigate the row", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      const editLink = within(row).getByRole("link", { name: /edit/i });
      fireEvent.click(editLink);
      expect(mockPush).not.toHaveBeenCalledWith("/buildings/b1/view");
    });
  });

  describe("Delete button for admin", () => {
    it("renders Delete button for admin user", async () => {
      renderPage();
      await screen.findByText("Tower A");
      expect(screen.getAllByRole("button", { name: /delete/i }).length).toBeGreaterThan(0);
    });

    it("does not render Delete button for non-admin", async () => {
      setupFetch({
        session: { user: { firstName: "Bob", lastName: "User", roleType: "user", email: "bob@example.com" } },
      });
      renderPage();
      await screen.findByText("Tower A");
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    });

    it("opens delete modal when Delete is clicked", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      expect(screen.getByRole("heading", { name: /delete building/i })).toBeInTheDocument();
    });

    it("modal shows the building name", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      const modalContent = screen.getByText(/are you sure you want to delete/i);
      expect(modalContent).toBeInTheDocument();
      expect(modalContent).toHaveTextContent(/Tower A/);
    });

    it("modal has a Cancel button", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("modal has a Delete confirm button", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      const modal = screen.getByRole("heading", { name: /delete building/i }).closest(".modal")!;
      expect(within(modal as HTMLElement).getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    });
  });

  describe("Cancel button", () => {
    it("closes the delete modal when Cancel is clicked", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByRole("heading", { name: /delete building/i })).not.toBeInTheDocument();
    });

    it("does not call the delete API when Cancel is clicked", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url, opts]: [string, RequestInit]) => opts?.method === "DELETE"
      );
      expect(deleteCalls).toHaveLength(0);
    });
  });

  describe("Delete confirm button", () => {
    it("calls DELETE /api/buildings/:id when confirmed", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      const modal = screen.getByRole("heading", { name: /delete building/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^delete$/i }));

      await waitFor(() => {
        const deleteCalls = (global.fetch as jest.Mock).mock.calls.filter(
          ([url, opts]: [string, RequestInit]) =>
            url.includes("/api/buildings/b1") && opts?.method === "DELETE"
        );
        expect(deleteCalls).toHaveLength(1);
      });
    });

    it("closes modal after successful delete", async () => {
      renderPage();
      await screen.findByText("Tower A");
      const row = screen.getByText("Tower A").closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: /delete/i }));
      const modal = screen.getByRole("heading", { name: /delete building/i }).closest(".modal")!;
      fireEvent.click(within(modal as HTMLElement).getByRole("button", { name: /^delete$/i }));

      await waitFor(() =>
        expect(screen.queryByRole("heading", { name: /delete building/i })).not.toBeInTheDocument()
      );
    });
  });

  describe("Empty buildings state", () => {
    it("shows No buildings when there are no buildings", async () => {
      setupFetch({ buildings: { data: [] } });
      renderPage();
      expect(await screen.findByText(/no buildings yet/i)).toBeInTheDocument();
    });

    it("shows Add your first building link when empty", async () => {
      setupFetch({ buildings: { data: [] } });
      renderPage();
      expect(await screen.findByRole("link", { name: /add your first building/i })).toBeInTheDocument();
    });
  });
});