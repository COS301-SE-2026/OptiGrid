import RealtimePage from "./page";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";

//these are few buildings in the raw snake_case shape which the API hands back 
const sandtonOffice = {
    building_id: "11111111-0000-0000-0000-000000000001",
    building_name: "Sandton Office",
    physical_address: "12 West St",
    building_type: "office",
    today_kwh: 100,
    status: "Normal",
};
const midrandWarehouse = {
    building_id: "22222222-0000-0000-0000-000000000002",
    building_name: "Midrand Warehouse",
    physical_address: "8 Depot Rd",
    building_type: "warehouse",
    today_kwh: 500,
    status: "Peak alert",
};
// there is no status and zero usage on purpose because the page should treat this one as offline
const rosebankStore = {
    building_id: "33333333-0000-0000-0000-000000000003",
    building_name: "Rosebank Store",
    physical_address: "3 Mall Ln",
    building_type: "retail",
    today_kwh: 0,
};

function mockBuildings(rows: object[], ok = true, message?: string) {
    (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
            ok,
            json: async () => (ok ? { data: rows } : { message }),
        } as Response),
    );
}
function renderPage() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    return render(
        <QueryClientProvider client={client}>
            <RealtimePage />
        </QueryClientProvider>,
    );
}

// check that the given names show up in this top-to-bottom order on the screen 
function expectOrder(names: string[]) {
    const cards = names.map((name) => screen.getByText(name));
    for (let i = 0; i < cards.length - 1; i++) {
        const nextComesAfter = cards[i].compareDocumentPosition(cards[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING;

        expect(nextComesAfter).toBeTruthy();
    }
}

beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("Loading state", () => {
    it("shows skeletons while the first request is still going", () => {
        (global.fetch as jest.Mock).mockReturnValue(new Promise(() => { }));
        const { container } = renderPage();
        expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    });
});

describe("Rendering readings", () => {
    it("draws a card for every building which the API sends back", async () => {
        mockBuildings([sandtonOffice, midrandWarehouse, rosebankStore]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());

        expect(screen.getByText("Midrand Warehouse")).toBeInTheDocument();
        expect(screen.getByText("Rosebank Store")).toBeInTheDocument();
    });

    it("shows a building's usage and address", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());
        expect(screen.getByText("100.00")).toBeInTheDocument();
        expect(screen.getByText("12 West St")).toBeInTheDocument();
    });

    it("links each building card to its detail view", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();

        const cardLink = await screen.findByRole("link", {
            name: /view live telemetry for sandton office/i,
        });

        expect(cardLink).toHaveAttribute(
            "href",
            "/buildings/11111111-0000-0000-0000-000000000001/view",
        );
    });

    it("marks a building offline when it reports zero usage and no status", async () => {
        mockBuildings([rosebankStore]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Rosebank Store")).toBeInTheDocument());
        expect(screen.getByText("Offline")).toBeInTheDocument();
    });

    it("shows when the data was last updated", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();
        await waitFor(() => expect(screen.getByText(/last updated/i)).toBeInTheDocument());
    });
});

describe("Sorting", () => {
    it("puts the heaviest users at the top", async () => {
        mockBuildings([sandtonOffice, rosebankStore, midrandWarehouse]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Midrand Warehouse")).toBeInTheDocument());

        expectOrder(["Midrand Warehouse", "Sandton Office", "Rosebank Store"]);
    });
});
describe("Building list", () => {
    it("shows every building under the All filter with the total count", async () => {
        mockBuildings([sandtonOffice, midrandWarehouse, rosebankStore]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());
        expect(screen.getByRole("button", { name: /all \(3\)/i })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByText("Midrand Warehouse")).toBeInTheDocument();
        expect(screen.getByText("Rosebank Store")).toBeInTheDocument();
    });

    it("narrows the list to the buildings matching the selected status filter", async () => {
        mockBuildings([sandtonOffice, midrandWarehouse, rosebankStore]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: /^peak alert \(1\)$/i }));

        expect(screen.getByText("Midrand Warehouse")).toBeInTheDocument();
        expect(screen.queryByText("Sandton Office")).not.toBeInTheDocument();
        expect(screen.queryByText("Rosebank Store")).not.toBeInTheDocument();
    });

    it("says nothing matches when a filter has no buildings", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());

        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: /^offline \(0\)$/i }));
        expect(screen.getByText(/no buildings match the offline filter/i)).toBeInTheDocument();
        expect(screen.queryByText("Sandton Office")).not.toBeInTheDocument();
    });

    it("does not render a manual refresh button", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());
        expect(screen.queryByRole("button", { name: /^refresh$/i })).not.toBeInTheDocument();
    });
});

describe("Empty and error states", () => {
    it("says there is nothing to monitor when the list is empty", async () => {
        mockBuildings([]);
        renderPage();
        await waitFor(() =>
            expect(screen.getByText(/no buildings to monitor/i)).toBeInTheDocument(),
        );
    });

    it("shows the API error message when the request fails", async () => {
        mockBuildings([], false, "Unauthorised");
        renderPage();
        await waitFor(() => expect(screen.getByText(/unauthorised/i)).toBeInTheDocument());
    });

    it("gives you a Try again button after an error occur", async () => {
        mockBuildings([], false, "Server error");
        renderPage();
        await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
});
