import { render, screen } from "@testing-library/react";
import InsightsClient from "./insights-client";

const mockUseQuery = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
    useMutation: () => ({ mutate: jest.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

describe("InsightsClient on open", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
    });

    it("opens on the busiest building", () => {
        mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) =>
            options?.queryKey?.[0] === "buildings"
                ? { data: [{ id: "1", name: "Sandton HQ", todayKwh: 20 }, { id: "2", name: "Rosebank Tower", todayKwh: 75 }] }
                : { data: [] },
        );
        render(<InsightsClient role="VIEWER" />);
        expect(mockUseQuery.mock.calls.at(-1)?.[0].queryKey).toEqual(["recommendations", "2", "all"]);
        expect(screen.getByText("Rosebank Tower", { selector: ".dashboard-section-meta" })).toBeInTheDocument();
    });

    it("still asks for a building when no vuilding ia assigned", () => {
        mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) =>
            options?.queryKey?.[0] === "buildings" ? { data: [] } : { data: [] },
        );
        render(<InsightsClient role="VIEWER" />);

        expect(screen.getByText(/select a building to view its optimisation recommendations/i)).toBeInTheDocument();
    });
});