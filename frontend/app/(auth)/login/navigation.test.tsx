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

describe("login navigation", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		global.fetch = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ user: { firstName: "Avery" } }),
		} as Response);
	});

	it("starts a fresh dashboard navigation after authentication succeeds", async () => {
		const user = userEvent.setup();
		render(<LoginPage />);

		await user.type(screen.getByLabelText("Work email"), "avery@example.com");
		await user.type(screen.getByLabelText("Password"), "StrongPass123!");
		await user.click(screen.getByRole("button", { name: "Log in" }));

		await waitFor(() => expect(navigateAfterLogin).toHaveBeenCalledTimes(1));
	});
});
