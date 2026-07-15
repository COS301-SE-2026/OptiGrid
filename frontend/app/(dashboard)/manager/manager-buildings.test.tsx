import ManagerBuildings from "./manager-buildings";
import React from "react";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockBuildings = [
    {
        building_id: "b1",
        building_name: "Sandton HQ",
        lifecycle_state: "ACTIVE",
        analytics: { todays_usage: 130.5 },
        authorized_users: [
            {
                user: {
                    userId: "u1",
                    firstName: "Duha",
                    lastName: "Emad",
                    email: "duha@example.com",
                    roleType: "VIEWER",
                },
            },
        ],
    },
    {
        building_id: "b2",
        building_name: "Green Park",
        lifecycle_state: "PROVISIONING",
        analytics: { todays_usage: 300.2 },
        authorized_users: [],
    },
    {
        building_id: "b3",
        building_name: "River Tower",
        lifecycle_state: "PROVISIONING_FAILED",
        analytics: null,
        authorized_users: null,
    },
];

const renderPage = async () => {
    render(<ManagerBuildings />);
    await waitFor(() => expect(screen.getByText("Sandton HQ")).toBeInTheDocument(),);
};
const tableRows = () => {
    const table = screen.getByRole("table");
    return within(table).getAllByRole("row").slice(1); //get rid of z header
};

beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "success", data: mockBuildings }),
    }) as jest.Mock;
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("ManagerBuildings", () => {
    it("renders the page heading", async () => {
        await renderPage();
        expect(screen.getByRole("heading", { name: /My Buildings/i }),).toBeInTheDocument();
    });

    it("lists the buildings assigned to the manager", async () => {
        await renderPage();
        expect(screen.getByText("Sandton HQ")).toBeInTheDocument();
        expect(screen.getByText("Green Park")).toBeInTheDocument();
        expect(screen.getByText("River Tower")).toBeInTheDocument();
        expect(screen.getByText(/3 buildings assigned to you/i)).toBeInTheDocument();
    });
    it("shows the owner of each building", async () => {
        await renderPage();
        const row = screen.getByText("Sandton HQ").closest("tr")!;

        expect(within(row).getByText("Duha Emad")).toBeInTheDocument();
    });

    it("shows a placeholder when a building has no owner or usage data", async () => {
        await renderPage();
        const row = screen.getByText("River Tower").closest("tr")!;
        expect(within(row).getAllByText("N/A")).toHaveLength(2);
    });

    it("links the edit action to the building edit page", async () => {
        await renderPage();
        const row = screen.getByText("Sandton HQ").closest("tr")!;
        expect(within(row).getByRole("link", { name: /edit/i })).toHaveAttribute(
            "href",
            "/buildings/b1/edit",);
    });

    it("filters the buildings by lifecycle state", async () => {
        await renderPage();
        fireEvent.change(screen.getByLabelText(/Lifecycle:/i), {
            target: { value: "ACTIVE" },
        });

        expect(screen.getByText("Sandton HQ")).toBeInTheDocument();
        expect(screen.queryByText("Green Park")).not.toBeInTheDocument();
        expect(screen.queryByText("River Tower")).not.toBeInTheDocument();
    });

    it("sorts the buildings by energy usage highest to lowest", async () => {
        await renderPage();
        fireEvent.change(screen.getByLabelText(/Energy usage:/i), {
            target: { value: "desc" },
        });
        const names = tableRows().map((row) => within(row).getAllByRole("cell")[0].textContent,);
        expect(names).toEqual(["Green Park", "Sandton HQ", "River Tower"]);
    });

    it("sorts buildings by energy usage lowest to highest and keeps unknown usage last", async () => {
        await renderPage();
        fireEvent.change(screen.getByLabelText(/Energy usage:/i), {
            target: { value: "asc" },
        });

        const names = tableRows().map((row) => within(row).getAllByRole("cell")[0].textContent,);
        expect(names).toEqual(["Sandton HQ", "Green Park", "River Tower"]);
    });

    it("resets the filters when Reset filters button is clicked", async () => {
        await renderPage();
        fireEvent.change(screen.getByLabelText(/Lifecycle:/i), {
            target: { value: "ACTIVE" },
        });
        fireEvent.click(screen.getByRole("button", { name: /reset filters/i }));
        expect(screen.getByLabelText(/Lifecycle:/i)).toHaveValue("all");
        expect(screen.getByText("Green Park")).toBeInTheDocument();
    });

    it("shows an error message when the fetch fails", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Authentication required." }),
        });
        render(<ManagerBuildings />);

        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent("Authentication required.",),
        );
    });
});