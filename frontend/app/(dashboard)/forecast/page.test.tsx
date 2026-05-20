import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForecastPage from "./page";

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
    useMutation: (options: unknown) => mockUseMutation(options),
}));

jest.mock("recharts", () => {
    const MockChart = ({ children }: { children?: ReactNode }) => (
        <div>{children}</div>
    );
    return {
        ResponsiveContainer: MockChart,
        ComposedChart: MockChart,
        CartesianGrid: () => null,
        Area: () => null,
        Line: () => null,
        ReferenceLine: () => null,
        Tooltip: () => null,
        XAxis: () => null,
        YAxis: () => null,
    };
});

const buildingsData = [
    { id: "1", name: "Sandton HQ" },
    { id: "2", name: "Rosebank Tower" },
];

const resultData = {
    historical: [
        { timestamp: "2026-05-19T12:00:00Z", kwh: 160 },
        { timestamp: "2026-05-19T13:00:00Z", kwh: 190 },
    ],
    forecast: [
        {
            timestamp: "2026-05-20T12:00:00Z",
            yhat: 210,
            yhat_lower: 180,
            yhat_upper: 240,
        },
    ],
    summary: {
        peak_kwh: 250,
        peak_timestamp: "2026-05-20T18:00:00Z",
        avg_daily_kwh: 1200,
        mape: 4.8,
    },
};

function setupQueries() {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options?.queryKey?.[0];
        if (key === "buildings") {
            return { data: buildingsData };
        }
        return { data: undefined };
    });
}

function setupMutation({
    data,
    isPending = false,
}: {
    data?: typeof resultData | undefined;
    isPending?: boolean;
} = {}) {
    const mutate = jest.fn();
    mockUseMutation.mockReturnValue({ mutate, isPending, data });
    return mutate;
}

describe("ForecastPage", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseMutation.mockReset();
    });

    it("renders the header and controls", () => {
        setupQueries();
        setupMutation();
        render(<ForecastPage />);

        expect(
            screen.getByRole("heading", { name: "Demand Forecast" })
        ).toBeInTheDocument();
        expect(screen.getAllByText(/run a forecast/i).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("combobox")).toHaveLength(3);
        expect(
            screen.getByRole("button", { name: "Run forecast" })
        ).toBeDisabled();
        expect(
            screen.getByText(/Configure the controls above/i)
        ).toBeInTheDocument();
    });

    it("enables the CTA and runs the forecast when a building is selected", async () => {
        setupQueries();
        const mutate = setupMutation();
        render(<ForecastPage />);

        const user = userEvent.setup();
        const selects = screen.getAllByRole("combobox");

        await user.selectOptions(selects[0], "1");

        const runButton = screen.getByRole("button", { name: "Run forecast" });
        expect(runButton).not.toBeDisabled();

        await user.click(runButton);

        expect(mutate).toHaveBeenCalledWith({
            building_id: "1",
            horizon_days: 7,
            granularity: "hourly",
        });
    });

    it("renders KPI values when a forecast result exists", () => {
        setupQueries();
        setupMutation({ data: resultData });
        render(<ForecastPage />);

        expect(screen.queryByText(/Configure the controls above/i)).toBeNull();
        expect(screen.getByText(/250 kWh/)).toBeInTheDocument();
        expect(screen.getByText(/1,?200 kWh/)).toBeInTheDocument();
        expect(screen.getByText(/MAPE 4.8%/)).toBeInTheDocument();
        expect(screen.getByText("95% interval")).toBeInTheDocument();
    });
});