/** @jest-environment node */
import { POST } from "./route";

function buildRequest(page: unknown, withAuth = true) {
    return new Request("http://localhost/api/audit-events/page-view", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(withAuth ? { cookie: "optigrid_access_token=access-token" } : {}),
        },
        body: JSON.stringify({ page }),
    });
}

describe("page-view audit proxy", () => {
    beforeEach(() => {
        process.env.CORE_URL = "https://core.test";
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 201,
            json: async () => ({ status: "success" }),
        }) as jest.Mock;
    });

    it("forwards a supported page and the authenticated session", async () => {
        const response = await POST(buildRequest("COMPARE"));

        expect(response.status).toBe(201);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://core.test/api/audit-events/page-view",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ page: "COMPARE" }),
            }),
        );
        const [, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect((options.headers as Headers).get("Authorization")).toBe("Bearer access-token");
    });

    it("rejects a page outside the allowlist", async () => {
        const response = await POST(buildRequest("ADMIN"));

        expect(response.status).toBe(400);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated request", async () => {
        const response = await POST(buildRequest("LIVE", false));

        expect(response.status).toBe(401);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
