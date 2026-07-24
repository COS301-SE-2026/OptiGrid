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

const portfolioConsumptionData = {
    daily: [
        { date: "2026-07-13", kwh: 3800, cost_zar: 0 },
        { date: "2026-07-14", kwh: 4100, cost_zar: 0 },
    ],
    today_kwh_by_building: {
        "1": 1847,
        "2": 1512,
    },
    estimated_cost_zar: null,
    active_alerts: 1,
};

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

function mockQueries({ buildings = buildingsData, portfolioConsumption = portfolioConsumptionData } = {}) {
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
            return { data: portfolioConsumption, isLoading: false };
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
 



it("renders the user's initials in the avatar", () => {
    mockQueries();
    render(<DashboardPage />);

    expect(screen.getByText("AE")).toBeInTheDocument();
});

it("renders the user's full name", () => {
    mockQueries();
    render(<DashboardPage />);

    expect(screen.getByText("Abdelrahman Esam")).toBeInTheDocument();
});

it("renders Edit links for every building", () => {
    mockQueries();
    render(<DashboardPage />);

    const editLinks = screen.getAllByRole("link", { name: "Edit" });

    expect(editLinks).toHaveLength(2);
    expect(editLinks[0]).toHaveAttribute("href", "/buildings/1/edit");
    expect(editLinks[1]).toHaveAttribute("href", "/buildings/2/edit");
});

it("opens the delete confirmation modal", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options?.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    userId: "1",
                    firstName: "Admin",
                    lastName: "User",
                    roleType: "ADMIN",
                },
                isLoading: false,
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: portfolioConsumptionData,
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                data: buildingsData,
                isLoading: false,
                dataUpdatedAt: Date.now(),
            };
        }

        return { data: undefined };
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getAllByLabelText("Delete")[0]);

    expect(
        screen.getByRole("heading", { name: /delete building/i })
    ).toBeInTheDocument();

    expect(
        screen.getByText(/are you sure you want to delete/i)
    ).toBeInTheDocument();
});

it("closes the delete modal when Cancel is clicked", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options?.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    firstName: "Admin",
                    lastName: "User",
                    roleType: "ADMIN",
                },
                isLoading: false,
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: portfolioConsumptionData,
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                data: buildingsData,
                isLoading: false,
                dataUpdatedAt: Date.now(),
            };
        }

        return {};
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getAllByLabelText("Delete")[0]);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
        screen.queryByRole("heading", {
            name: /delete building/i,
        })
    ).not.toBeInTheDocument();
});

it("calls mutate when Delete is confirmed", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options?.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    firstName: "Admin",
                    lastName: "User",
                    roleType: "ADMIN",
                },
                isLoading: false,
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: portfolioConsumptionData,
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                data: buildingsData,
                isLoading: false,
                dataUpdatedAt: Date.now(),
            };
        }

        return {};
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getAllByLabelText("Delete")[0]);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(mockMutate).toHaveBeenCalledWith("1");
});

it("does not render Delete buttons for non-admin users", () => {
    mockQueries();

    render(<DashboardPage />);

    expect(screen.queryByLabelText("Delete")).not.toBeInTheDocument();
});

it("renders portfolio consumption heading", () => {
    mockQueries();

    render(<DashboardPage />);

    expect(
        screen.getByText(/portfolio consumption, last 7 days/i)
    ).toBeInTheDocument();
});

it("renders all building statuses", () => {
    mockQueries();

    render(<DashboardPage />);

    expect(screen.getByText("Normal")).toBeInTheDocument();
    expect(screen.getByText("Peak alert")).toBeInTheDocument();
});

it("renders today's kWh values", () => {
    mockQueries();

    render(<DashboardPage />);

    expect(screen.getByText("1,847")).toBeInTheDocument();
    expect(screen.getByText("1,512")).toBeInTheDocument();
});

it("shows loading placeholders while buildings are loading", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    firstName: "Abdelrahman",
                    lastName: "Esam",
                },
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                data: [],
                isLoading: true,
                dataUpdatedAt: Date.now(),
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: undefined,
                isLoading: true,
            };
        }

        return {};
    });

    render(<DashboardPage />);

    expect(screen.getByText("Buildings")).toBeInTheDocument();
    expect(screen.getByText("Today's usage")).toBeInTheDocument();
});


it("renders the buildings error message", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    firstName: "Abdelrahman",
                    lastName: "Esam",
                },
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: portfolioConsumptionData,
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                isLoading: false,
                isError: true,
                error: new Error("Backend unavailable"),
                dataUpdatedAt: Date.now(),
            };
        }

        return {};
    });

    render(<DashboardPage />);

    expect(screen.getByText("Backend unavailable")).toBeInTheDocument();
});


it("shows Delete button only for admins", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    firstName: "Admin",
                    lastName: "User",
                    roleType: "ADMIN",
                },
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: portfolioConsumptionData,
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                data: buildingsData,
                isLoading: false,
                dataUpdatedAt: Date.now(),
            };
        }

        return {};
    });

    render(<DashboardPage />);

    expect(screen.getAllByLabelText("Delete")).toHaveLength(2);
});


it("renders estimated cost when available", () => {
    mockQueries({
        portfolioConsumption: {
            ...portfolioConsumptionData,
            estimated_cost_zar: 15324,
        },
    });

    render(<DashboardPage />);

    expect(screen.getByText("R 15,324")).toBeInTheDocument();
});

it("does not navigate when Edit is clicked", () => {
    mockQueries();

    render(<DashboardPage />);

    fireEvent.click(screen.getAllByLabelText("Edit")[0]);

    expect(mockPush).not.toHaveBeenCalled();
});


it("renders Offline badge", () => {
    mockQueries({
        buildings: [
            {
                id: "1",
                name: "Offline Building",
                location: "Pretoria",
                type: "Office",
                todayKwh: 0,
                status: "Offline",
            },
        ],
    });

    render(<DashboardPage />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
});


it("closes delete modal when clicking outside", () => {
    mockUseQuery.mockImplementation((options: any) => {
        const key = options.queryKey?.[0];

        if (key === "auth-session") {
            return {
                data: {
                    firstName: "Admin",
                    lastName: "User",
                    roleType: "ADMIN",
                },
            };
        }

        if (key === "portfolio-consumption") {
            return {
                data: portfolioConsumptionData,
                isLoading: false,
            };
        }

        if (key === "buildings") {
            return {
                data: buildingsData,
                isLoading: false,
                dataUpdatedAt: Date.now(),
            };
        }

        return {};
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getAllByLabelText("Delete")[0]);

    fireEvent.click(document.querySelector(".modal-overlay")!);

    expect(
        screen.queryByText(/delete building/i)
    ).not.toBeInTheDocument();
});


});
