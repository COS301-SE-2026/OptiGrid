import { renderHook, waitFor } from "@testing-library/react";
import { useTabSessionId } from "./use-tab-session-id";

const TAB_ID = "00000000-0000-4000-8000-000000000001";

jest.mock("./tab-session", () => ({
	getTabSessionId: jest.fn(() => TAB_ID),
}));

describe("useTabSessionId", () => {
	it("exposes the tab id after the component mounts", async () => {
		const { result } = renderHook(() => useTabSessionId());

		await waitFor(() => expect(result.current).toBe(TAB_ID));
	});
});
