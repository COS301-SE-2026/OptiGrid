/** @jest-environment node */

import { POST } from "./route";

describe("analytics refresh [buildingId] route", () => {
    beforeEach(() => {
        process.env.CORE_URL = "http://core.test";
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 202,
            json: async () => ({ status: "accepted" }),
        }) as jest.Mock;
    });

    it("forwards an authenticated refresh request to core", async () => {
        const request = new Request("http://localhost/api/analytics/refresh/building-123", {
            method: "POST",
            headers: {
                cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
            },
        });

        const response = await POST(request, {
            params: Promise.resolve({ buildingId: "building-123" }),
        });

        expect(response.status).toBe(202);
        expect(global.fetch).toHaveBeenCalledWith(
            "http://core.test/api/analytics/refresh/building-123",
            expect.objectContaining({
                method: "POST",
                cache: "no-store",
                headers: expect.objectContaining({ Cookie: expect.stringContaining("optigrid_session=") }),
            }),
        );
    });

    it("rejects requests without a session", async () => {
        const response = await POST(
            new Request("http://localhost/api/analytics/refresh/building-123", { method: "POST" }),
            { params: Promise.resolve({ buildingId: "building-123" }) },
        );

        expect(response.status).toBe(401);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
