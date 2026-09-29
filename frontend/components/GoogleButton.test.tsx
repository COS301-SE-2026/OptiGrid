import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GoogleAuthButton, { OAUTH_INTENT_COOKIE } from "./GoogleButton";

const mockSignIn = jest.fn();

jest.mock("@/lib/supabaseClient", () => ({
    createClient: () => ({ auth: { signInWithOAuth: mockSignIn } }),
}));

describe("GoogleAuthButton", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSignIn.mockResolvedValue({ error: null });
        document.cookie = `${OAUTH_INTENT_COOKIE}=; Path=/; Max-Age=0`;
    });

    it("marks the Google round trip as a recovery when asked to", async () => {
        const user = userEvent.setup();
        render(<GoogleAuthButton intent="recover" label="Recover with Google" showDivider={false} />);

        await user.click(screen.getByRole("button", { name: "Recover with Google" }));
        expect(document.cookie).toContain(`${OAUTH_INTENT_COOKIE}=recover`);
        expect(mockSignIn).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
        expect(screen.queryByText("or")).not.toBeInTheDocument();
    });

    it("clears any old recovery marks on a normal sign in", async () => {
        document.cookie = `${OAUTH_INTENT_COOKIE}=recover; Path=/`;
        const user = userEvent.setup();
        render(<GoogleAuthButton />);

        await user.click(screen.getByRole("button", { name: "Continue with Google" }));
        expect(document.cookie).not.toContain(`${OAUTH_INTENT_COOKIE}=recover`);
    });
});