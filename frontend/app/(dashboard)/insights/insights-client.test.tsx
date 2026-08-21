import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InsightsClient from "./insights-client";

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
    useMutation: (options: unknown) => mockUseMutation(options),
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
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

function setupMutation({
    isPending = false,
    variables,
}: {
    isPending?: boolean;
    variables?: { action: string; recommendationId: string };
} = {}) {
    const mutate = jest.fn();
    mockUseMutation.mockReturnValue({ mutate, isPending, variables });
    return mutate;
}

function renderPage(role = "ADMIN") {
    return render(<InsightsClient role={role} />);
}

async function selectBuilding() {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/building/i), "1");
    return user;
}

async function openReview() {
    const user = await selectBuilding();
    const cards = within(screen.getByRole("list")).getAllByRole("listitem");
    await user.click(within(cards[0]).getByRole("button", { name: /review/i }));
    
    return user;
}

describe("InsightsPage", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseMutation.mockReset();
        mockInvalidateQueries.mockReset();
        setupMutation();
    });

    it("renders the header and filter controls", () => {
        setupQueries();
        renderPage();

        expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
        expect(screen.getByLabelText(/building/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    });

    it("prompts the user to pick a building before loading anything", () => {
        setupQueries();
        renderPage();

        expect(screen.getByText(/select a building to view its optimisation recommendations/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/status/i)).toBeDisabled();
    });

    it("lists the strategies and their estimated savings once a building is selected", async () => {
        setupQueries();
        renderPage();
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
        renderPage();
        await selectBuilding();

        expect(screen.getByText("14:00 to 18:00")).toBeInTheDocument();
        expect(screen.getByText("AC_Zone_Primary")).toBeInTheDocument();
        expect(screen.getByText("85%")).toBeInTheDocument();
    });

    it("summarises only the active recommendations", async () => {
        setupQueries();
        renderPage();
        await selectBuilding();

        const summary = screen.getByLabelText("Recommendation summary");
        //the expired one is excluded from both the count and the savings total
        expect(within(summary).getByText("1")).toBeInTheDocument();
        expect(within(summary).getByText("R 1,840.50")).toBeInTheDocument();
        expect(within(summary).getByText("2")).toBeInTheDocument();
    });

    it("gives a badge for each recommendation with its status", async () => {
        setupQueries();
        renderPage();
        await selectBuilding();

        const cards = within(screen.getByRole("list")).getAllByRole("listitem");

        expect(within(cards[0]).getByText("Pending")).toHaveClass("badge-warning");
        expect(within(cards[1]).getByText("Expired")).toHaveClass("badge-danger");
    });

    it("filters by status", async () => {
        setupQueries();
        renderPage();
        const user = await selectBuilding();

        await user.selectOptions(screen.getByLabelText(/status/i), "Pending");

        const lastCall = mockUseQuery.mock.calls.at(-1)?.[0];
        expect(lastCall.queryKey).toEqual(["recommendations", "1", "Pending"]);
    });

    it("shows an empty state when the building has no recommendations", async () => {
        setupQueries({ recommendations: { data: [] } });
        renderPage();
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
        renderPage();
        await selectBuilding();

        expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    });

    it("shows a buildings load failure alert", () => {
        setupQueries({ buildings: { isError: true } });
        renderPage();

        expect(screen.getByRole("alert")).toHaveTextContent(/unable to load your assigned buildings/i);
    });

    it("tells the user when no buildings are assigned to them", () => {
        setupQueries({ buildings: { data: [] } });
        renderPage();

        expect( screen.getByText(/no buildings are currently assigned to your account/i)).toBeInTheDocument();
    });
});

describe("Reviewing a recommendation", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseMutation.mockReset();
        mockInvalidateQueries.mockReset();
        setupMutation();
    });

    it("offers a review action to managers and admins", async () => {
        setupQueries();
        renderPage("BUILDING_MANAGER");
        await selectBuilding();

        expect(screen.getAllByRole("button", { name: /review/i })).toHaveLength(2);
    });

    it("does not offer a review action to viewers", async () => {
        setupQueries();
        renderPage("VIEWER");
        await selectBuilding();

        expect(screen.queryByRole("button", { name: /review/i })).not.toBeInTheDocument();
    });

    it("opens a dialog with the detailed cost estimates", async () => {
        setupQueries();
        renderPage();
        await openReview();

        const dialog = screen.getByRole("dialog", { name: /review recommendation/i });
        expect(within(dialog).getByText(/reduce ac usage during peak hours/i)).toBeInTheDocument();
        expect(within(dialog).getByText("R 1,840.50")).toBeInTheDocument();
        expect(within(dialog).getByText(/R 22,086.00 per year/i)).toBeInTheDocument();
        expect(within(dialog).getByText("210.5 kW")).toBeInTheDocument();
        expect(within(dialog).getByText("312.4 kW")).toBeInTheDocument();
        expect(within(dialog).getByText("101.9 kW")).toBeInTheDocument();
        expect(within(dialog).getByText("Africa/Johannesburg")).toBeInTheDocument();
    });

    it("approves the insight through the apply endpoint", async () => {
        setupQueries();
        const mutate = setupMutation();
        renderPage();
        const user = await openReview();

        const dialog = screen.getByRole("dialog", { name: /review recommendation/i });
        await user.click(within(dialog).getByRole("button", { name: "Approve" }));

        expect(mutate).toHaveBeenCalledWith({ action: "apply", recommendationId: "rec-1" });
    });

    it("dismisses the insight through the dismiss endpoint", async () => {
        setupQueries();
        const mutate = setupMutation();
        renderPage();
        const user = await openReview();

        const dialog = screen.getByRole("dialog", { name: /review recommendation/i });
        await user.click(within(dialog).getByRole("button", { name: "Dismiss" }));

        expect(mutate).toHaveBeenCalledWith({ action: "dismiss", recommendationId: "rec-1" });
    });

    it("blocks both actions on an expired recommendation", async () => {
        setupQueries();
        renderPage();
        const user = await selectBuilding();

        const cards = within(screen.getByRole("list")).getAllByRole("listitem");
        await user.click(within(cards[1]).getByRole("button", { name: /review/i }));

        const dialog = screen.getByRole("dialog", { name: /review recommendation/i });
        expect(within(dialog).getByRole("button", { name: "Approve" })).toBeDisabled();
        expect(within(dialog).getByRole("button", { name: "Dismiss" })).toBeDisabled();
        expect(within(dialog).getByText(/has expired and can no longer be applied/i)).toBeInTheDocument();
    });

    it("reports a conflict returned by the apply endpoint", async () => {
        setupQueries();
        mockUseMutation.mockImplementation((options: { onError?: (e: Error) => void }) => ({
            mutate: () => options.onError?.(new Error("This recommendation has expired.")),
            isPending: false,
            variables: undefined,
        }));
        renderPage();
        const user = await openReview();

        const dialog = screen.getByRole("dialog", { name: /review recommendation/i });
        await user.click(within(dialog).getByRole("button", { name: "Approve" }));

        expect(screen.getByRole("alert")).toHaveTextContent("This recommendation has expired.");
    });

    it("shows progress while an approval is in flight", async () => {
        setupQueries();
        setupMutation({ isPending: true, variables: { action: "apply", recommendationId: "rec-1" } });
        renderPage();
        await openReview();

        const dialog = screen.getByRole("dialog", { name: /review recommendation/i });
        expect(within(dialog).getByRole("button", { name: "Approving..." })).toBeDisabled();
        expect(within(dialog).getByRole("button", { name: "Close" })).toBeDisabled();
    });
});