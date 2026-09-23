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


describe("BillingClient", () => {
    beforeEach(() => {
        mockUseBuildings.mockReset();
        setupBuildings();
        mockResponse(200, { status: "success", message: "Tariff rates updated successfully." });
    });

    it("renders the tariff form", () => {
        render(<BillingClient />);

        expect(screen.getByRole("heading", { name: "Advanced Tariff Builder" })).toBeInTheDocument();
        expect(screen.getByLabelText(/Target Building/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Save Tariff Schedule" })).toBeInTheDocument();
    });

    it("sends the TOU payload to the tariffs endpoint", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        
        await user.selectOptions(screen.getByLabelText(/Target Building/i), "1");
        
        await user.click(screen.getByRole("button", { name: "Save Tariff Schedule" }));

        await waitFor(() => expect(global.fetch).toHaveBeenCalled());
        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(url).toBe("/api/buildings/1/tariffs");
        expect(options.method).toBe("PUT");
        
        const payload = JSON.parse(options.body);
        expect(payload.type).toBe("tou");
        expect(payload.blocks).toHaveLength(1);
        expect(payload.blocks[0].rates.Summer.Peak).toBe(2.50);
    });

    it("confirms the update once it succeeds", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText(/Target Building/i), "1");
        await user.click(screen.getByRole("button", { name: "Save Tariff Schedule" }));

        expect(await screen.findByText(/tariff rates updated successfully/i)).toBeInTheDocument();
    });

    it("requires a building to be selected", async () => {
        render(<BillingClient />);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "Save Tariff Schedule" }));

        expect(await screen.findByText(/Please select a building/i)).toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("shows a rejection from the API", async () => {
        mockResponse(403, { status: "error", message: "Strictly Admin or Building Manager" });
        render(<BillingClient />);
        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText(/Target Building/i), "1");
        await user.click(screen.getByRole("button", { name: "Save Tariff Schedule" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Strictly Admin or Building Manager");
    });
});