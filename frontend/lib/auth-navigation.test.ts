import { navigateAfterLogin } from "./auth-navigation";
import { getTabSessionPath } from "./tab-session";

jest.mock("./tab-session", () => ({
	getTabSessionPath: jest.fn(() => "/_sessions/test-tab-id/dashboard"),
}));

describe("post-login navigation", () => {
	it("replaces the document with the tab-scoped dashboard URL", () => {
		const replaceLocation = jest.fn();

		navigateAfterLogin(replaceLocation, "test-tab-id");

		expect(getTabSessionPath).toHaveBeenCalledWith("/dashboard", "test-tab-id");
		expect(replaceLocation).toHaveBeenCalledWith("/_sessions/test-tab-id/dashboard");
	});
});
