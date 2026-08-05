import { navigateAfterLogin } from "./auth-navigation";
import { getTabSessionPath } from "./tab-session";

jest.mock("./tab-session", () => ({
	getTabSessionPath: jest.fn(() => "/_sessions/test-tab-id/dashboard"),
}));

describe("post-login navigation", () => {
	it("replaces the current route with the tab-scoped dashboard URL", () => {
		const replaceRoute = jest.fn();

		navigateAfterLogin(replaceRoute);

		expect(getTabSessionPath).toHaveBeenCalledWith("/dashboard");
		expect(replaceRoute).toHaveBeenCalledWith("/_sessions/test-tab-id/dashboard");
	});
});
