import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingClient from "./billing-client";

const mockUseBuildings = jest.fn();

jest.mock("@/lib/useBuildings", () => ({
    useBuildings: () => mockUseBuildings(),
}));

const buildingsData = [
    { id: "1", name: "Sandton HQ" },
    { id: "2", name: "Rosebank Tower" }
];

function setupBuildings(state: unknown = { data: buildingsData }) {
    mockUseBuildings.mockReturnValue(state);
}

function mockFetch(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as jest.Mock;
}

async function selectBuilding(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("combobox", { name: /building/i }));
    await user.click(
        within(screen.getByRole("listbox")).getByRole("option", { name: "Sandton HQ" })
    );
}

describe("BillingClient", () => {
    beforeEach(() => {
        mockUseBuildings.mockReset();
        setupBuildings();
        mockFetch(200, { status: "success", message: "Tariff rates updated successfully." });
    });

    it("renders the tariff form", () => {
        render(<BillingClient />);

        expect(screen.getByRole("heading", { name: "Utility Tariff Rates" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /building/i })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Summer" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Winter" })).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Summer" })).getByLabelText("Peak")).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Winter" })).getByLabelText("Peak")).toBeInTheDocument();
    });

    it("sends the seasonal rates to the tariffs endpoint", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await selectBuilding(user);

        await user.click(screen.getByRole("button", { name: "Save tariff schedule" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe("/api/buildings/1/tariffs");
        expect(options.method).toBe("PUT");

        const body = JSON.parse(options.body);
        expect(body.type).toBe("tou");
        expect(body.blocks[0].rates.Summer.Peak).toBe(2.5);
        expect(body.blocks[0].rates.Summer["Off-Peak"]).toBe(1.0);
        expect(body.blocks[0].rates.Winter.Peak).toBe(3.5);
        expect(body.blocks[0].rates.Winter["Off-Peak"]).toBe(1.5);
    });

    it("reflects an edited rate value in the submitted payload", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await selectBuilding(user);

        const summerPeak = within(screen.getByRole("region", { name: "Summer" })).getByLabelText("Peak");
        await user.clear(summerPeak);
        await user.type(summerPeak, "4.99");

        await user.click(screen.getByRole("button", { name: "Save tariff schedule" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
        expect(body.blocks[0].rates.Summer.Peak).toBe(4.99);
    });

    it("confirms the update once it succeeds", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await selectBuilding(user);

        await user.click(screen.getByRole("button", { name: "Save tariff schedule" }));

        expect(await screen.findByText(/tariff rates updated successfully/i)).toBeInTheDocument();
    });

    it("requires a building before submitting", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "Save tariff schedule" }));

        expect(await screen.findByText(/please select a building/i)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("shows a rejection returned by the API", async () => {
        mockFetch(403, { status: "error", message: "Strictly Admin or Building Manager" });
        render(<BillingClient />);
        const user = userEvent.setup();
        await selectBuilding(user);

        await user.click(screen.getByRole("button", { name: "Save tariff schedule" }));

        expect(await screen.findByText(/Strictly Admin or Building Manager/i)).toBeInTheDocument();
        
    });

    it("tells the user when no buildings are assigned to them", () => {
        setupBuildings({ data: [] });
        render(<BillingClient />);

        expect(screen.getByText(/no buildings are currently assigned/i)).toBeInTheDocument();
    });

    it("reports a buildings load failure", () => {
        setupBuildings({ isError: true });
        render(<BillingClient />);

        expect(screen.getByRole("alert")).toHaveTextContent(/unable to load your buildings/i);
    });
});