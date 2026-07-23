/** @jest-environment node */
import {GET } from "./route";

const fecth = global.fetch;

describe("Unit Tests for the route.ts file in Mangers page", () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        jest.clearAllMocks();
    });
    afterAll(() => {global.fetch = fecth;});

    it("should_send_request_successfully", async () => {
        const cookie = "optigrid_access_token=test_token_123";
        const req = new Request("http://localhost/api/buildings/manager", {
            headers: {
                "Cookie": cookie,
                "Authorization": "Valid"
            }
        });
        const streamResp = {
            data: []
        };

        (global.fetch as jest.Mock).mockResolvedValue({
            json: jest.fn().mockResolvedValueOnce(streamResp)
        });
        //act
        const resp = await GET(req);
        //assert
        const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
        expect(options.headers.get("Authorization")).toBe("Valid");
        expect(options.headers.get("Cookie")).toBe("optigrid_access_token=test_token_123");
    });

    it("should_return_401_if_no_headers", async () => {
        const req = new Request("http://localhost/api/buildings/manager");
        //act
        const resp = await GET(req);
        const data = await resp.json();
        //assert
        expect(resp.status).toBe(401);
        expect(data).toEqual({
            message: "Authentication required"
        });
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should_retun_502_for_unexpected_erro", async () => {
        const cookie = "optigrid_access_token=test_token_123";
        const req = new Request("http://localhost/api/buildings/manager", {
            headers: {
                "Cookie": cookie,
                "Authorization": "Vaild"
            }
        });
        const streamResp = {
            data: []
        };

        (global.fetch as jest.Mock).mockResolvedValue(new TypeError("some error"));
        //act
        const resp = await GET(req);
        const data = await resp.json();
        //assert
        expect(resp.status).toBe(502);
        expect(data).toEqual({
            message: "Unexpected Error"
        });
        expect(global.fetch).toHaveBeenCalled();
    })
})