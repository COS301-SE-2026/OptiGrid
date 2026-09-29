import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "./page";

const mockPush = jest.fn();
const mockExchange = jest.fn();
const mockGetSession = jest.fn();
const mockUpdateUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/supabaseClient", () => ({
    createClient: () => ({
        auth: {
            exchangeCodeForSession: mockExchange,
            verifyOtp: jest.fn(),
            getSession: mockGetSession,
            updateUser: mockUpdateUser,
            signOut: mockSignOut,
        },
    }),
}));

describe("ResetPasswordPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExchange.mockResolvedValue({ error: null });
        mockGetSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
        mockUpdateUser.mockResolvedValue({ error: null });
        mockSignOut.mockResolvedValue({ error: null });
    });

    it("rejects a visit that did not come from a reset link", async () => {
        window.history.replaceState(null, "", "/reset-password");
        render(<ResetPasswordPage />);

        expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
        expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
    });

    it("rejects an expired link", async () => {
        window.history.replaceState(null, "", "/reset-password?code=old-code");
        mockExchange.mockResolvedValue({ error: { message: "expired" } });
        render(<ResetPasswordPage />);

        expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument();
    });

    it("keeps the form open when the passwords do not match", async () => {
        window.history.replaceState(null, "", "/reset-password?code=good-code");
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(await screen.findByLabelText("New password"), "Strong1!pass");
        await user.type(screen.getByLabelText("Confirm new password"), "Strong1!other");
        await user.click(screen.getByRole("button", { name: "Save new password" }));

        expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
        expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("saves the new password and sends the user back to log in", async () => {
        window.history.replaceState(null, "", "/reset-password?code=good-code");
        const user = userEvent.setup();
        render(<ResetPasswordPage />);

        await user.type(await screen.findByLabelText("New password"), "Strong1!pass");
        await user.type(screen.getByLabelText("Confirm new password"), "Strong1!pass");
        await user.click(screen.getByRole("button", { name: "Save new password" }));

        await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login?reset=1"));
        expect(mockExchange).toHaveBeenCalledWith("good-code");
        expect(mockUpdateUser).toHaveBeenCalledWith({ password: "Strong1!pass" });
        expect(mockSignOut).toHaveBeenCalled();
    });
});