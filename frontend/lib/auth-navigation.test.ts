import { navigateAfterLogin } from "./auth-navigation";
import { getTabSessionPath } from "./tab-session";

jest.mock("./tab-session", () => ({
	getTabSessionPath: jest.fn(() => "/_sessions/test-tab-id/dashboard"),
	TAB_SESSION_HEADER: "x-optigrid-tab-id",
}));

describe("post-login navigation", () => {
	it("replaces the document with the tab-scoped dashboard URL after confirming the session", async () => {
		const replaceLocation = jest.fn();
		const fetchSession = jest.fn().mockResolvedValue({ ok: true } as Response);
		const waitForRetry = jest.fn();

		await navigateAfterLogin(replaceLocation, "test-tab-id", fetchSession, waitForRetry);

		expect(fetchSession).toHaveBeenCalledWith("/api/auth/session", expect.objectContaining({
			headers: { "x-optigrid-tab-id": "test-tab-id" },
		}));
		expect(getTabSessionPath).toHaveBeenCalledWith("/dashboard", "test-tab-id");
		expect(replaceLocation).toHaveBeenCalledWith("/_sessions/test-tab-id/dashboard");
	});

	it("waits for a delayed session before navigating", async () => {
		const replaceLocation = jest.fn();
		const fetchSession = jest
			.fn()
			.mockResolvedValueOnce({ ok: false } as Response)
			.mockResolvedValueOnce({ ok: true } as Response);
		const waitForRetry = jest.fn().mockResolvedValue(undefined);

		await navigateAfterLogin(replaceLocation, "test-tab-id", fetchSession, waitForRetry);

		expect(fetchSession).toHaveBeenCalledTimes(2);
		expect(waitForRetry).toHaveBeenCalledWith(75);
		expect(replaceLocation).toHaveBeenCalledTimes(1);
	});

	it("keeps the user on the login page when the session never becomes available", async () => {
		const replaceLocation = jest.fn();
		const fetchSession = jest.fn().mockResolvedValue({ ok: false } as Response);
		const waitForRetry = jest.fn().mockResolvedValue(undefined);

		await expect(navigateAfterLogin(replaceLocation, "test-tab-id", fetchSession, waitForRetry))
			.rejects.toThrow("Your session could not be established. Please try again.");

		expect(fetchSession).toHaveBeenCalledTimes(4);
		expect(replaceLocation).not.toHaveBeenCalled();
	});
});
