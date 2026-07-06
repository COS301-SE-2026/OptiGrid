import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import CompareBuildingPage from "./page";

const mockUseQuery = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
}));

jest.mock("recharts", () => {
    const MockChart = ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
    );
    return {
        ResponsiveContainer: MockChart,
        LineChart: MockChart,
        CartesianGrid: () => null,
        Line: () => null,
        Tooltip: () => null,
        XAxis: () => null,
        YAxis: () => null,
    };
});

const buildingIdA = "11111111-1111-4111-8111-111111111111";
const buildingIdB = "22222222-2222-4222-8222-222222222222";
const buildingIdC = "33333333-3333-4333-8333-333333333333";

const buildingsData = [
    { id: buildingIdA, name: "Building A", squareFootage: 2500 },
    { id: buildingIdB, name: "Building B", squareFootage: 1800 },
    { id: buildingIdC, name: "Sandton HQ", squareFootage: 2700 },
];

const comparisonData = {
    time_range: "30d",
    mostEfficient: buildingIdB,
    buildingA: {
        building_id: buildingIdA,
        name: "Building A",
        total_kwh: 8200,
        total_cost_zar: 12500,
        square_footage: 2500,
        eui: 3.28,
        cost_per_sq_ft: 5,
        cost_per_kwh: 1.52,
    },
    buildingB: {
        building_id: buildingIdB,
        name: "Building B",
        total_kwh: 6000,
        total_cost_zar: 9800,
        square_footage: 1800,
        eui: 3.33,
        cost_per_sq_ft: 5.44,
        cost_per_kwh: 1.63,
    },
};

function setupQueries({
    buildings = buildingsData,
    comparison = comparisonData,
    buildingsLoading = false,
    buildingsError = false,
    comparisonError = false,
}: {
    buildings?: typeof buildingsData;
    comparison?: typeof comparisonData | undefined;
    buildingsLoading?: boolean;
    buildingsError?: boolean;
    comparisonError?: boolean;
} = {}) {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options?.queryKey?.[0];
        if (key === "buildings") {
            return {
                data: buildings,
                isLoading: buildingsLoading,
                isError: buildingsError,
                error: buildingsError ? new Error("Unable to load buildings.") : null,
            };
        }

        if (key === "building-comparison") {
            return {
                data: comparison,
                isLoading: false,
                isFetching: false,
                isError: comparisonError,
                error: comparisonError ? new Error("Unable to compare buildings.") : null,
            };
        }

        return {};
    });
}

describe("CompareBuildingPage", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
    });

    it("renders building controls from assigned buildings", async () => {
        setupQueries();
        render(<CompareBuildingPage />);

        expect(screen.getByRole("heading", { name: /compare buildings/i })).toBeInTheDocument();
        expect(screen.getAllByRole("combobox")).toHaveLength(4);
        expect(screen.getAllByRole("option", { name: "Building A" }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("option", { name: "Building B" }).length).toBeGreaterThan(0);

        await waitFor(() => {
            expect(screen.getByLabelText("Building 1")).toHaveValue(buildingIdA);
            expect(screen.getByLabelText("Building 2")).toHaveValue(buildingIdB);
        });
    });

    it("displays comparison totals for the selected buildings", async () => {
        setupQueries();
        render(<CompareBuildingPage />);

        expect(await screen.findByText("R 12,500")).toBeInTheDocument();
        expect(screen.getByText("R 9,800")).toBeInTheDocument();
        expect(screen.getByText("2,500 m2")).toBeInTheDocument();
        expect(screen.getByText("1,800 m2")).toBeInTheDocument();
        expect(screen.getByText(/Building A is higher for the selected metric/)).toBeInTheDocument();
    });

    it("switches between cost and energy metrics", async () => {
        setupQueries();
        render(<CompareBuildingPage />);

        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText("Metric"), "kWh");

        expect(await screen.findByText("8,200 kWh")).toBeInTheDocument();
        expect(screen.getByText("6,000 kWh")).toBeInTheDocument();
        expect(screen.getByText(/30 days - energy/i)).toBeInTheDocument();
    });

    it("shows a useful empty state when fewer than two buildings are assigned", () => {
        setupQueries({
            buildings: [buildingsData[0]],
            comparison: undefined,
        });

        render(<CompareBuildingPage />);

        expect(screen.getByText(/Add another building before running a comparison/i)).toBeInTheDocument();
        expect(screen.getByText(/Select two different buildings to compare/i)).toBeInTheDocument();
    });
});
