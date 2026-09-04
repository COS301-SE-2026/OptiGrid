import { render, screen, waitFor } from "@testing-library/react";
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
function mockResponse(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    }) as jest.Mock;
}

async function fillRates(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(screen.getByLabelText(/building/i), "1");
    await user.type(screen.getByLabelText(/^peak rate/i), "0.33");
    await user.type(screen.getByLabelText(/off-peak rate/i), "0.22");
}

describe("BillingClient", () => {
    beforeEach(() => {
        mockUseBuildings.mockReset();
        setupBuildings();
        mockResponse(200, { status: "success", message: "Tariff rates updated successfully." });
    });

    it("renders the tariff form", () => {
        render(<BillingClient />);

        expect(screen.getByRole("heading", { name: "Update tariff rates" })).toBeInTheDocument();
        expect(screen.getByLabelText(/building/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/season/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/^peak rate/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/off-peak rate/i)).toBeInTheDocument();
    });

    it("sends the seasonal rates to the tariffs endpoint", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await fillRates(user);
        await user.selectOptions(screen.getByLabelText(/season/i), "Winter");

        await user.click(screen.getByRole("button", { name: "Save rates" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe("/api/buildings/1/tariffs");
        expect(options.method).toBe("PUT");
        expect(JSON.parse(options.body)).toEqual({
            season_name: "Winter",
            peak_rate_zar: 0.33,
            off_peak_rate_zar: 0.22,
        });
    });

    it("confirms the update once it succeeds", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await fillRates(user);

        await user.click(screen.getByRole("button", { name: "Save rates" }));

        expect(await screen.findByText(/tariff rates updated successfully/i)).toBeInTheDocument();
    });

    it("requires a building and both rates", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "Save rates" }));

        expect(await screen.findByText(/select the building these rates apply to/i)).toBeInTheDocument();
        expect(screen.getByText(/^peak rate is required/i)).toBeInTheDocument();
        expect(screen.getByText(/^off-peak rate is required/i)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });
    it("rejects an off-peak rate above the peak rate", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText(/building/i), "1");
        await user.type(screen.getByLabelText(/^peak rate/i), "0.20");
        await user.type(screen.getByLabelText(/off-peak rate/i), "0.40");

        await user.click(screen.getByRole("button", { name: "Save rates" }));

        expect(await screen.findByText(/off-peak rate should not be higher/i)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("rejects a negative rate", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText(/building/i), "1");
        await user.type(screen.getByLabelText(/^peak rate/i), "-1");
        await user.type(screen.getByLabelText(/off-peak rate/i), "0.22");

        await user.click(screen.getByRole("button", { name: "Save rates" }));

        expect(await screen.findByText(/peak rate cannot be negative/i)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("show a rejection from the API", async () => {
        mockResponse(403, { status: "error", message: "Strictly Admin or Building Manager" });
        render(<BillingClient />);
        const user = userEvent.setup();
        await fillRates(user);

        await user.click(screen.getByRole("button", { name: "Save rates" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Strictly Admin or Building Manager");
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