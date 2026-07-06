import { render, screen, fireEvent } from "@testing-library/react";
import DashboardPage from "./page";

const mockUseQuery = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockMutate = jest.fn();

jest.mock("@tanstack/react-query", () => ({
    useQuery: (options: unknown) => mockUseQuery(options),
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
    useMutation: () => ({
        mutate: mockMutate,
        isPending: false,
    }),
}));


const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));


jest.mock("next/link", () => {
    return function MockLink({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) {
        return (
            <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {children}
            </a>
        );
    };
});

jest.mock("recharts", () => {
    const MockChart = ({ children }: { children?: React.ReactNode }) => (
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

const consumptionData = [
    { day: "Mon", kwh: 3800 },
    { day: "Tue", kwh: 4100 },
];

const buildingsData = [
    {
        id: "1",
        name: "Sandton HQ",
        location: "Sandton, JHB",
        type: "Office",
        todayKwh: 1847,
        status: "Normal",
    },
    {
        id: "2",
        name: "Rosebank Tower",
        location: "Rosebank, JHB",
        type: "Office",
        todayKwh: 1512,
        status: "Peak alert",
    },
];

function mockQueries({ buildings = buildingsData } = {}) {
    const now = Date.now();
    mockUseQuery.mockImplementation((options: any) => {
        const key = options?.queryKey?.[0];
        if (key === "auth-session") {
            return {
                data: {
                    userId: "user-123",
                    email: "abdelrahman@example.com",
                    firstName: "Abdelrahman",
                    lastName: "Esam",
                },
                isLoading: false,
            };
        }
        if (key === "portfolio-consumption") {
            return { data: consumptionData, isLoading: false };
        }
        if (key === "buildings") {
            return { data: buildings, isLoading: false, dataUpdatedAt: now };
        }
        return { data: undefined, isLoading: false };
    });
}

describe("DashboardPage", () => {
    beforeEach(() => {
        mockUseQuery.mockReset();
        mockInvalidateQueries.mockReset();
        mockMutate.mockReset();
        mockPush.mockReset();
        jest.spyOn(window, "confirm").mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("renders the header and KPI values", () => {
        mockQueries();
        render(<DashboardPage />);

        expect(
            screen.getByRole("heading", { name: "Welcome back, Abdelrahman" })
        ).toBeInTheDocument();
        expect(screen.getByText(/last updated just now/i)).toBeInTheDocument();
        expect(screen.getByText("Buildings")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByText("3,359 kWh")).toBeInTheDocument();
        expect(screen.getAllByText("--").length).toBeGreaterThan(0);
        expect(screen.getByText("Active alerts")).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("renders the add building CTA", () => {
        mockQueries();
        render(<DashboardPage />);

        const link = screen.getByRole("link", { name: "+ Add building" });
        expect(link).toHaveAttribute("href", "/buildings/add");
    });

    it("renders building rows when data exists", () => {
        mockQueries();
        render(<DashboardPage />);

        expect(screen.getByText("Sandton HQ")).toBeInTheDocument();
        expect(screen.getByText("Rosebank Tower")).toBeInTheDocument();
        expect(screen.getAllByText("Office")).toHaveLength(2);
        expect(screen.getByText("Normal")).toBeInTheDocument();
    });

    it("renders empty state when no buildings", () => {
        mockQueries({ buildings: [] });
        render(<DashboardPage />);

        expect(screen.getByText("No buildings yet.")).toBeInTheDocument();
        const addLink = screen.getByRole("link", {
            name: "Add your first building",
        });
        expect(addLink).toHaveAttribute("href", "/buildings/add");
    });

    it("navigates to the building details page when the building card is clicked", () => {
    mockQueries();
    render(<DashboardPage />);

     fireEvent.click(screen.getByText("Sandton HQ"));

    expect(mockPush).toHaveBeenCalledWith("/buildings/1/view");




});
});
