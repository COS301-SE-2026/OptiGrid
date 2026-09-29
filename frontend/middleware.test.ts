import { NextRequest, NextResponse } from "next/server";
import { middleware } from "./middleware";

jest.mock("next/server", () => ({
	NextResponse: {
		next: jest.fn().mockReturnValue("next_response"),
		rewrite: jest.fn().mockReturnValue("rewrite_response"),
	},
}));

describe("middleware", () => {
	beforeEach(() => {jest.clearAllMocks();});

	it("shoudl_return_next()", () => {
		const req = {
			nextUrl: {
				pathname: "/dashboard",
				clone: jest.fn(),
			},
			headers: new Headers(),
		} as unknown as NextRequest;
		//act
		const resp = middleware(req);
		//assert
		expect(resp).toBe("next_response");
		expect(NextResponse.next).toHaveBeenCalled();
	});

	it("should_rewrtie_url", () => {
		const mockClone = {pathname: "/_sessions/tab123/buildings/add",};
		const req = {
			nextUrl: {
				pathname: "/_sessions/tab123/buildings/add",
				clone: jest.fn().mockReturnValue(mockClone),
			},
			headers: new Headers([["x-test", "val"]]),
		} as unknown as NextRequest;
		//act
		const resp = middleware(req);
		//assert
		expect(resp).toBe("rewrite_response");
		expect(NextResponse.rewrite).toHaveBeenCalled();
		const callArgs = (NextResponse.rewrite as jest.Mock).mock.calls[0];
		expect(callArgs[0].pathname).toBe("/buildings/add");
		expect(callArgs[1].request.headers.get("x-test")).toBe("val");
		expect(callArgs[1].request.headers.get("x-optigrid-tab-id")).toBe("tab123");
	});

	it("shoudl_rewrite_to_dashboard", () => {
		const mockClone = {pathname: "/_sessions/tab123",};
		const req = {
			nextUrl: {
				pathname: "/_sessions/tab123",
				clone: jest.fn().mockReturnValue(mockClone),
			},
			headers: new Headers(),
		} as unknown as NextRequest;

		const resp = middleware(req);
		expect(resp).toBe("rewrite_response");
		const callArgs = (NextResponse.rewrite as jest.Mock).mock.calls[0];
		expect(callArgs[0].pathname).toBe("/dashboard");
		expect(callArgs[1].request.headers.get("x-optigrid-tab-id")).toBe("tab123");
	});

	it("preserves the tab-scoped auth cookies when stale root cookies are also present", () => {
		const mockClone = { pathname: "/_sessions/tab123/dashboard" };
		const req = {
			nextUrl: {
				pathname: "/_sessions/tab123/dashboard",
				clone: jest.fn().mockReturnValue(mockClone),
			},
			headers: new Headers([[
				"cookie",
				"optigrid_session=scoped-session; optigrid_access_token=scoped-token; optigrid_session=stale-root-session; optigrid_access_token=stale-root-token; theme=dark",
			]]),
		} as unknown as NextRequest;

		middleware(req);

		const callArgs = (NextResponse.rewrite as jest.Mock).mock.calls[0];
		expect(callArgs[1].request.headers.get("cookie")).toBe(
			"optigrid_session=scoped-session; optigrid_access_token=scoped-token; theme=dark",
		);
	});
});
