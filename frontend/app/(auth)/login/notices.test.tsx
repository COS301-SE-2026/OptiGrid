import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

jest.mock("../../../lib/auth-navigation", () => ({
	navigateAfterLogin: jest.fn(),
}));

jest.mock("../../../lib/tab-session", () => ({
	getTabSessionId: jest.fn(() => "test-tab-id"),
	TAB_SESSION_HEADER: "x-optigrid-tab-id",
}));

describe("login notices", () => {
	afterEach(() => {
		window.history.replaceState(null, "", "/login");
	});

	it("confirms that every device was signed out", async () => {
		window.history.replaceState(null, "", "/login?signedOut=all");

		render(<LoginPage />);

		expect(await screen.findByText("You have been signed out on all your devices. Log in again to continue.")).toBeInTheDocument();
	});
});