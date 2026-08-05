import { navigateAfterLogin } from "./auth-navigation";
import { getTabSessionPath } from "./tab-session";

jest.mock("./tab-session", () => ({
	getTabSessionPath: jest.fn(() => "/_sessions/test-tab-id/dashboard"),
}));

describe("post-login navigation", () => {
	it("replaces the document with the tab-scoped dashboard URL", () => {
		const replaceLocation = jest.fn();

		navigateAfterLogin(replaceLocation);

		expect(getTabSessionPath).toHaveBeenCalledWith("/dashboard");
		expect(replaceLocation).toHaveBeenCalledWith("/_sessions/test-tab-id/dashboard");
	});
});
