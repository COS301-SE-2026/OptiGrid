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
        const headers = opt.headers as Headers;
        //assert
        expect(resp.status).toBe(200);
        expect(data.status).toBe("success");
        expect(data.data[0].building_id).toBe("building-123");
        expect(url).toBe("http://core:4000/api/buildings/admin?lifecycle_state=ACTIVE");

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

    it("should-return_502", async () => {
        const req = new Request("http://localhost/api/buildings/admin?lifecycle_state=ACTIVE", {
            method: "GET",
        });
        //act
        const resp= await GET(req);
        const data = await resp.json();
         //assert
        expect(resp.status).toBe(401);
        expect(data.message).toBe("Authentication required.");
    });
});
