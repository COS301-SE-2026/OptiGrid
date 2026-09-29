import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForecastPage from "./page";
import { chooseCurvedOption } from "@/test-utils/curvedSelect";

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
    metadata: {
        timezone: "Africa/Johannesburg",
        value_unit: "kW",
        average_unit: "kWh/day",
        accuracy_metric: "MAPE",
    },
};

type TestForecastResult = Omit<typeof resultData, "summary"> & {
    summary: Omit<typeof resultData.summary, "mape"> & { mape: number | null };
};

function setupQueries() {
    mockUseQuery.mockImplementation((options) => {
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
    data?: TestForecastResult | undefined;
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
        expect(screen.getAllByRole("combobox")).toHaveLength(2);
        expect(
            screen.getByRole("button", { name: "Run forecast" })
        ).toBeEnabled();
        expect(
            screen.getByText(/Configure the controls above/i)
        ).toBeInTheDocument();
    });

    it("enables the CTA and runs the forecast when a building is selected", async () => {
        setupQueries();
        const mutate = setupMutation();
        render(<ForecastPage />);

        const user = userEvent.setup();
        chooseCurvedOption(screen.getByLabelText(/building/i), "1");

        const runButton = screen.getByRole("button", { name: "Run forecast" });
        expect(runButton).not.toBeDisabled();

        await user.click(runButton);

        expect(mutate).toHaveBeenCalledWith({
            building_id: "1",
            horizon: "weekly",
        });
    });

    it("runs monthly forecast when horizon is changed to monthly", async () => {
        setupQueries();
        const mutate = setupMutation();
        render(<ForecastPage />);

        const user = userEvent.setup();
        chooseCurvedOption(screen.getByLabelText(/building/i), "1");
        chooseCurvedOption(screen.getByLabelText(/horizon/i), "monthly");

        const runButton = screen.getByRole("button", { name: "Run forecast" });
        await user.click(runButton);

        expect(mutate).toHaveBeenCalledWith({
            building_id: "1",
            horizon: "monthly",
        });
    });

    it("queues and polls when a building has no generated forecast", async () => {
        jest.useFakeTimers();
        setupQueries();
        setupMutation();
        global.fetch = jest.fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 404,
                json: async () => ({ message: "Forecast models are currently being generated." }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 202,
                json: async () => ({ status: "accepted" }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => resultData,
            });

        try {
            render(<ForecastPage />);
            const mutationOptions = mockUseMutation.mock.calls[0][0] as {
                mutationFn: (params: { building_id: string; horizon: "monthly" }) => Promise<typeof resultData>;
            };
            const resultPromise = mutationOptions.mutationFn({ building_id: "1", horizon: "monthly" });

            await jest.advanceTimersByTimeAsync(1_500);

            await expect(resultPromise).resolves.toEqual(resultData);
            expect(global.fetch).toHaveBeenNthCalledWith(
                2,
                "/api/analytics/refresh/1",
                { method: "POST" },
            );
            expect(global.fetch).toHaveBeenCalledTimes(3);
        } finally {
            jest.useRealTimers();
        }
    });

    it("renders KPI values when a forecast result exists", () => {
        setupQueries();
        setupMutation({ data: resultData });
        render(<ForecastPage />);

        expect(screen.queryByText(/Configure the controls above/i)).toBeNull();
        expect(screen.getByText(/Demand Trend/i)).toBeInTheDocument();
        expect(screen.getByText(/250 kW/)).toBeInTheDocument();
        expect(screen.getByText(/1,?200 kWh\/day/)).toBeInTheDocument();
        expect(screen.getByText(/MAPE 4.8%/)).toBeInTheDocument();
        expect(screen.getAllByText(/May 20, 20:00/).length).toBeGreaterThan(0);
        expect(screen.getByText("Forecast error")).toBeInTheDocument();
        expect(screen.getByText("Predicted")).toBeInTheDocument();
        expect(screen.queryByText("95% interval")).toBeNull();
    });

    it("renders real KPI values after fetching from the API", async () => {
    const mockApiResponse = {
        historical: [{ timestamp: "2026-05-20T23:16:06.839Z", kwh: 120.2 }],
        forecast: [{ timestamp: "2026-05-21T12:00:00Z", yhat: 300, yhat_lower: 290, yhat_upper: 310 }],
        summary: {
            peak_kwh: 350.5,
            peak_timestamp: "2026-05-20T23:16:06.839Z",
            avg_daily_kwh: 120.2,
            mape: 2.1
        },
        metadata: {
            timezone: "Africa/Johannesburg",
            value_unit: "kW",
            average_unit: "kWh/day",
            accuracy_metric: "MAPE"
        },
    };

    setupQueries();
    setupMutation({ data: mockApiResponse });
    render(<ForecastPage />);

    const user = userEvent.setup();
    chooseCurvedOption(screen.getByLabelText(/building/i), "1");
    await user.click(screen.getByRole("button", { name: /run forecast/i }));

    //assert
    expect(await screen.findByText(/350\.5 kW/)).toBeInTheDocument();
    expect(await screen.findByText(/120\.2 kWh\/day/)).toBeInTheDocument();
    expect(await screen.findByText(/MAPE 2\.1%/)).toBeInTheDocument();
});

    it("does not present missing model error as zero percent", () => {
        setupQueries();
        setupMutation({
            data: {
                ...resultData,
                summary: { ...resultData.summary, mape: null },
            },
        });

        render(<ForecastPage />);

        expect(screen.getByText("Accuracy unavailable")).toBeInTheDocument();
        expect(screen.queryByText(/MAPE 0%/)).toBeNull();
    });

    it("labels monthly forecasts as weekly energy", () => {
        setupQueries();
        setupMutation({
            data: {
                ...resultData,
                metadata: {
                    ...resultData.metadata,
                    value_unit: "kWh/week",
                    average_unit: "kWh/week",
                },
            },
        });

        render(<ForecastPage />);
        chooseCurvedOption(screen.getByLabelText(/horizon/i), "monthly");

        expect(screen.getByText("Peak weekly energy")).toBeInTheDocument();
        expect(screen.getByText(/250 kWh\/week/)).toBeInTheDocument();
    });
});
