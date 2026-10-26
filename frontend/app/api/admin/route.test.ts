/** @jest-environment node */
import { GET } from "../admin/route";

describe("Admin Page routes.ts Unit tests", () => {
    beforeEach(() => {
        process.env.CORE_URL = "http://core.test";
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status:200,
            json: async () => ({
                status: "success",
                data: [
                    {
                        building_id: "building-123",
                        building_name: "Sandton HQ",
                        lifecycle_state: "ACTIVE"
                    }
                ],
            }),
        }) as jest.Mock;
    });

    afterEach(() => {jest.clearAllMocks()});

    it("should_return_200_and_pass_query", async () => {
        const req = new Request("http://localhost/api/buildings/admin?lifecycle_state=ACTIVE", {
            method: "GET",
            headers: {
                cookie: "optigrid_access_token=test-123"
            },
        });
        //act
        const resp= await GET(req);
        const data = await resp.json();
        const [url, opt] = (global.fetch as jest.Mock).mock.calls[0];
        //assert
        expect(resp.status).toBe(200);
        expect(data.status).toBe("success");
        expect(data.data[0].building_id).toBe("building-123");
        expect(url).toBe("http://core:4000/api/buildings/admin?lifecycle_state=ACTIVE");
        expect((opt.headers as Headers).get("Authorization")).toBe("Bearer test-123");
    });

    it("keeps a crafted lifecycle state inside its own query value", async () => {
        const req = new Request(`http://localhost/api/admin?lifecycle_state=${encodeURIComponent("ACTIVE&role=ADMIN")}`, {
            headers: { cookie: "optigrid_access_token=test-123" },
        });

        await GET(req);

        const [url] = (global.fetch as jest.Mock).mock.calls[0];
        expect(new URL(url).searchParams.get("lifecycle_state")).toBe("ACTIVE&role=ADMIN");
        expect(new URL(url).searchParams.has("role")).toBe(false);
    });

    it("should_return_error_401_if_no_auth", async () => {
        const req = new Request("http://localhost/api/buildings/admin?lifecycle_state=ACTIVE", {
            method: "GET",
        });
        //act
        const resp= await GET(req);
        const data = await resp.json();
         //assert
        expect(resp.status).toBe(401);
        expect(data.message).toBe("Authentication required.");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should_return_502_when_core_is_unreachable", async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error("connection refused"));
        const req = new Request("http://localhost/api/buildings/admin?lifecycle_state=ACTIVE", {
            method: "GET",
            headers: { cookie: "optigrid_access_token=test-123" },
        });
        //act
        const resp= await GET(req);
        const data = await resp.json();
         //assert
        expect(resp.status).toBe(502);
        expect(data.message).toBe("Unable to reach the buildings service.");
    });
});
