import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "./page";

const mockReset = jest.fn();

jest.mock("@/lib/supabaseClient", () => ({
    createClient: () => ({ auth: { resetPasswordForEmail: mockReset } }),
}));

describe("ForgotPasswordPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockReset.mockResolvedValue({ error: null });
    });

    it("sends a reset link that returns to the reset page", async () => {
        const user = userEvent.setup();
        render(<ForgotPasswordPage />);

        await user.type(screen.getByLabelText("Work email"), "avery@example.com");
        await user.click(screen.getByRole("button", { name: "Send reset link" }));

        expect(mockReset).toHaveBeenCalledWith("avery@example.com", {
            redirectTo: `${window.location.origin}/reset-password`,
        });
        expect(await screen.findByText(/a reset link is on its way/i)).toBeInTheDocument();
    });

    it("explains when the email could not be sent", async () => {
        mockReset.mockResolvedValue({ error: { message: "rate limited" } });
        const user = userEvent.setup();
        render(<ForgotPasswordPage />);

        await user.type(screen.getByLabelText("Work email"), "avery@example.com");
        await user.click(screen.getByRole("button", { name: "Send reset link" }));

        expect(await screen.findByText(/could not send the email/i)).toBeInTheDocument();
    });

    it("does not send anything for an invalid email", async () => {
        const user = userEvent.setup();
        render(<ForgotPasswordPage />);

        await user.type(screen.getByLabelText("Work email"), "not-an-email");
        await user.click(screen.getByRole("button", { name: "Send reset link" }));

        expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
        expect(mockReset).not.toHaveBeenCalled();
    });
});