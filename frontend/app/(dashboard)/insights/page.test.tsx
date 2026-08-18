import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InsightsPage from "./page";

const mockUseQuery = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
}));

const buildingsData = [
    { id: "1", name: "Sandton HQ" },
    { id: "2", name: "Rosebank Tower" }
];

const recommendationsData = [
    {
        recommendation_id: "rec-1",
        strategy_description: "Reduce AC usage during peak hours to avoid 312.4kW peak. Peak-to-base ratio is 1.82.",
        estimated_monthly_savings: 1840.5,
        status: "Pending",
        applicable_range: {
            time_window: { start: "14:00", end: "18:00", timezone: "Africa/Johannesburg" },
            load_bounds_kw: { min_expected: 210.5, max_allowed: 312.4 },
            target_equipment: "AC_Zone_Primary",
            confidence_score: 0.85,
        },
        expires_at: "2099-01-01T00:00:00Z",
        generated_date: "2026-08-01T00:00:00Z",
    },
    {
        recommendation_id: "rec-2",
        strategy_description: "Pre-cool the building at 05:00 to shift load off peak.",
        estimated_monthly_savings: 620,
        status: "Expired",
        applicable_range: null,
        expires_at: "2026-01-01T00:00:00Z",
        generated_date: "2025-12-01T00:00:00Z",
    }
];

type QueryState = {
    data?: unknown;
    isLoading?: boolean;
    isError?: boolean;
    error?: Error;
};

function setupQueries({
    buildings = { data: buildingsData },
    recommendations = { data: recommendationsData },
}: {
    buildings?: QueryState;
    recommendations?: QueryState;
} = {}) {
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
        const key = options?.queryKey?.[0];
        if (key === "buildings") {
            return buildings;
        }

        return recommendations;
    });
}

async function selectBuilding() {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/building/i), "1");
    return user;
}

describe("InsightsPage", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
    });

    it("renders the header and filter controls", () => {
        setupQueries();
        render(<InsightsPage />);

        expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
        expect(screen.getByLabelText(/building/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    it("prompts the user to pick a building before loading anything", () => {
        setupQueries();
        render(<InsightsPage />);

        expect(screen.getByText(/select a building to view its optimisation recommendations/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeDisabled();
    });

    it("lists the strategies and their estimated savings once a building is selected", async () => {
        setupQueries();
        render(<InsightsPage />);
        await selectBuilding();

        const list = screen.getByRole("list");
        const cards = within(list).getAllByRole("listitem");
        expect(cards).toHaveLength(2);

        expect(within(cards[0]).getByText(/reduce ac usage during peak hours/i)).toBeInTheDocument();
        expect(within(cards[0]).getByText("R 1,840.50")).toBeInTheDocument();
        expect(within(cards[1]).getByText(/pre-cool the building at 05:00/i)).toBeInTheDocument();
        expect(within(cards[1]).getByText("R 620.00")).toBeInTheDocument();
    });

    it("shows the applicable range details for a recommendation", async () => {
        setupQueries();
        render(<InsightsPage />);
        await selectBuilding();

        expect(screen.getByText("14:00 to 18:00")).toBeInTheDocument();
        expect(screen.getByText("AC_Zone_Primary")).toBeInTheDocument();
        expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("summarises only the active recommendations", async () => {
        setupQueries();
        render(<InsightsPage />);
        await selectBuilding();

        const summary = screen.getByLabelText("Recommendation summary");
        //the expired one is excluded from both the count and the savings total
        expect(within(summary).getByText("1")).toBeInTheDocument();
        expect(within(summary).getByText("R 1,840.50")).toBeInTheDocument();
        expect(within(summary).getByText("2")).toBeInTheDocument();
    });

    it("gives a badge for each recommendation with its status", async () => {
        setupQueries();
        render(<InsightsPage />);
        await selectBuilding();

        const cards = within(screen.getByRole("list")).getAllByRole("listitem");

        expect(within(cards[0]).getByText("Pending")).toHaveClass("badge-warning");
        expect(within(cards[1]).getByText("Expired")).toHaveClass("badge-danger");
    });

    it("filters by status", async () => {
        setupQueries();
        render(<InsightsPage />);
        const user = await selectBuilding();

        await user.selectOptions(screen.getByLabelText(/status/i), "Pending");

        const lastCall = mockUseQuery.mock.calls.at(-1)?.[0];
        expect(lastCall.queryKey).toEqual(["recommendations", "1", "Pending"]);
    });

    it("shows an empty state when the building has no recommendations", async () => {
        setupQueries({ recommendations: { data: [] } });
        render(<InsightsPage />);
        await selectBuilding();

        expect(screen.getByText(/no optimisation recommendations have been generated/i)).toBeInTheDocument();
    });

    it("shows a recommendation load failure alert", async () => {
        setupQueries({
            recommendations: { 
                isError: true, 
                error: new Error("Access denied") 
            },
        });
        render(<InsightsPage />);
        await selectBuilding();

        expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    });

    it("shows a buildings load failure alert", () => {
        setupQueries({ buildings: { isError: true } });
        render(<InsightsPage />);

        expect(screen.getByRole("alert")).toHaveTextContent(/unable to load your assigned buildings/i);
    });

    it("tells the user when no buildings are assigned to them", () => {
        setupQueries({ buildings: { data: [] } });
        render(<InsightsPage />);

        expect( screen.getByText(/no buildings are currently assigned to your account/i)).toBeInTheDocument();
    });
});