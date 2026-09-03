import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { navigateAfterLogin } from "../../../lib/auth-navigation";
import LoginPage from "./page";

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
	useRouter: () => ({ replace: mockReplace }),
}));

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

	it("replaces the current route after authentication succeeds", async () => {
		const originalLocation = window.location;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		delete (window as any).location;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).location = { ...originalLocation, href: '' };

		const user = userEvent.setup();
		render(<LoginPage />);

		await user.type(screen.getByLabelText("Work email"), "avery@example.com");
		await user.type(screen.getByLabelText("Password"), "StrongPass123!");
		await user.click(screen.getByRole("button", { name: "Log in" }));

		await waitFor(() => expect(navigateAfterLogin).toHaveBeenCalledTimes(1));
		const replaceRoute = jest.mocked(navigateAfterLogin).mock.calls[0][0];
		replaceRoute("/_sessions/test-tab-id/dashboard");
		expect(window.location.href).toBe("/_sessions/test-tab-id/dashboard");

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(window as any).location = originalLocation;
	});
});
