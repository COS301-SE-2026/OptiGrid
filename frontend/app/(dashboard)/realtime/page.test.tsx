import RealtimePage from "./page";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
        expect(screen.getByText("100")).toBeInTheDocument();
        expect(screen.getByText("12 West St")).toBeInTheDocument();
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
describe("Filtering", () => {
    it("only keeps the buildings in alert state once the alerts filter is on", async () => {
        mockBuildings([sandtonOffice, midrandWarehouse, rosebankStore]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());
        fireEvent.click(screen.getByRole("button", { name: /alerts \(2\)/i }));

        expect(screen.queryByText("Sandton Office")).not.toBeInTheDocument();
        expect(screen.getByText("Midrand Warehouse")).toBeInTheDocument();
        expect(screen.getByText("Rosebank Store")).toBeInTheDocument();
    });

    it("makes the alert filter's color grey when nothing is in alert", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());
        expect(screen.getByRole("button", { name: /alerts \(0\)/i })).toBeDisabled();
    });

    it("brings everyone back when you switch to All", async () => {
        mockBuildings([sandtonOffice, midrandWarehouse, rosebankStore]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: /alerts \(2\)/i }));
        fireEvent.click(screen.getByRole("button", { name: /all \(3\)/i }));
        expect(screen.getByText("Sandton Office")).toBeInTheDocument();
    });
});

describe("Manual refresh", () => {
    it("fetches again when you hit Refresh", async () => {
        mockBuildings([sandtonOffice]);
        renderPage();
        await waitFor(() => expect(screen.getByText("Sandton Office")).toBeInTheDocument());

        const callsSoFar = (global.fetch as jest.Mock).mock.calls.length;
        fireEvent.click(screen.getByRole("button", { name: /^refresh$/i }));

        await waitFor(() =>
            expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsSoFar),
        );
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