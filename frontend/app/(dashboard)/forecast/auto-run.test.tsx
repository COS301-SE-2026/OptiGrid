import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import ForecastPage from "./page";

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
    useMutation: (options: unknown) => mockUseMutation(options),
}));

jest.mock("recharts", () => {
    const MockChart = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
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

function setup(buildings: Array<{ id: string; name: string; todayKwh?: number | null }>) {
    mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) =>
        options?.queryKey?.[0] === "buildings" ? { data: buildings } : { data: undefined },
    );
    const mutate = jest.fn();
    mockUseMutation.mockReturnValue({ mutate, isPending: false, data: undefined });
    return mutate;
}

describe("ForecastPage on open", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockUseMutation.mockReset();
    });

    it("runs a weekly forecast for the busiest building", () => {
        const mutate = setup([
            { id: "1", name: "Sandton HQ", todayKwh: 120 },
            { id: "2", name: "Rosebank Tower", todayKwh: 480 },
        ]);
        render(<ForecastPage />);

        expect(mutate).toHaveBeenCalledTimes(1);
        expect(mutate).toHaveBeenCalledWith({ building_id: "2", horizon: "weekly" });
    });

    it("runs only once when the page renders again", () => {
        const mutate = setup([{ id: "1", name: "Sandton HQ", todayKwh: 90 }]);
        const { rerender } = render(<ForecastPage />);
        rerender(<ForecastPage />);

        expect(mutate).toHaveBeenCalledTimes(1);
    });

    it("waits until there is a building to forecast", () => {
        const mutate = setup([]);
        render(<ForecastPage />);

        expect(mutate).not.toHaveBeenCalled();
    });
});