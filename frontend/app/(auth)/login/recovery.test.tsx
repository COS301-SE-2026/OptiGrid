import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { navigateAfterLogin } from "../../../lib/auth-navigation";
import LoginPage from "./page";

jest.mock("../../../lib/auth-navigation", () => ({
	navigateAfterLogin: jest.fn(),
}));

jest.mock("../../../lib/tab-session", () => ({
	getTabSessionId: jest.fn(() => "test-tab-id"),
	TAB_SESSION_HEADER: "x-optigrid-tab-id",
}));

function respond(status: number, body: unknown) {
	return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
}

async function logIn() {
	const user = userEvent.setup();
	render(<LoginPage />);
	await user.type(screen.getByLabelText("Work email"), "avery@example.com");
	await user.type(screen.getByLabelText("Password"), "StrongPass123!");
	await user.click(screen.getByRole("button", { name: "Log in" }));
	return user;
}

describe("recovering a deleted account", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(navigateAfterLogin).mockResolvedValue(undefined);
		window.history.replaceState(null, "", "/login");
	});

	it("offers recovery instead of signing in when the account was deleted", async () => {
		global.fetch = jest.fn(() => respond(403, { code: "ACCOUNT_DEACTIVATED", message: "This account is deactivated." })) as jest.Mock;

		await logIn();

		expect(await screen.findByText(/This account was deleted/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Recover account" })).toBeInTheDocument();
		expect(navigateAfterLogin).not.toHaveBeenCalled();
	});

	it("recovers the account with the same details and opens the dashboard", async () => {
		global.fetch = jest.fn((url: string) =>
			url === "/api/auth/recover-account" ? respond(200, { user: { firstName: "Avery" } }) : respond(403, { code: "ACCOUNT_DEACTIVATED" }),
		) as jest.Mock;

		const user = await logIn();
		await user.click(await screen.findByRole("button", { name: "Recover account" }));

		await waitFor(() => expect(navigateAfterLogin).toHaveBeenCalledWith(undefined, "test-tab-id"));
		const recoverCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === "/api/auth/recover-account");
		expect(JSON.parse(recoverCall[1].body)).toEqual({ email: "avery@example.com", password: "StrongPass123!" });
	});

	it("explains how to recover after deleting an account", async () => {
		window.history.replaceState(null, "", "/login?deleted=1");
		render(<LoginPage />);
		expect(await screen.findByText(/Your account has been deleted/i)).toBeInTheDocument();
	});

	it("shows the reason when a recovery fails", async () => {
		global.fetch = jest.fn((url: string) =>
			url === "/api/auth/recover-account"
				? respond(400, { message: "Invalid email or password" })
				: respond(403, { code: "ACCOUNT_DEACTIVATED" }),
		) as jest.Mock;

		const user = await logIn();
		await user.click(await screen.findByRole("button", { name: "Recover account" }));

		expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
		expect(navigateAfterLogin).not.toHaveBeenCalled();
	});

	it("offers Google recovery when a deleted account signs in with Google", async () => {
		window.history.replaceState(null, "", "/login?error=OAuthDeactivated");
		render(<LoginPage />);

		expect(await screen.findByText(/This Google account was deleted/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Recover with Google" })).toBeInTheDocument();
	});

	it("links to the forgot password page", () => {
		render(<LoginPage />);
		expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
	});
});