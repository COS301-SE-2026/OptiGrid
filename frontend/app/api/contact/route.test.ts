/** @jest-environment node */
import { POST } from "./route"

describe("Contact-Us route for integration", () => {
    beforeEach(() => {
        process.env.CORE_URL = "http://core.test"
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                message: "Received the ticket",
                id: "email-111",
            }),
        }) as jest.Mock;
    });
    
    afterEach(() => { jest.clearAllMocks});

    it("should_pass_the_payload_and_key_to_the_core", async () => {
        //arrange
        const req = new Request("http://localhost/api/contract", {
            method: "POST",
            headers: {
                cookie: "optigrid_session=%7B%22userId%22%3A%22user-123%22%7D",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                inquiryType: "Building",
                subject: "Testing ",
                message: "Test Message needs to be more than 10 char"
            }),
        });
        //act
        const resp = await POST(req);
        const data = await resp.json();
        const [url, opt]= (global.fetch as jest.Mock).mock.calls[0];
        const headers = opt.headers as Record<string, string>;
        //assert
        expect(resp.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.id).toBe("email-111");
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(url).toBe("http://core.test/api/contract");
        expect(headers.cookie).toContain("optigrid_session=");
        expect(headers["Idempotency-Key"]).toMatch(/^contact-/);
        expect(opt.body).toContain("Test Message needs to be more than 10 char");
        
    });

    it("shoudl_return_400_error_if_invalid_data_send", async () => {
        const req = new Request("http://localhost/api/contract", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: "{ broken json: ",
        });
        //act
        const resp = await POST(req);
        const data = await resp.json();
        //assert
        expect(resp.status).toBe(400);
        expect(data.message).toBe("Invalid request body");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should_return_502_error_ifservice_offline", async () => {
        //arrange 
        (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("fetch failed"));
        const req = new Request("http://localhost/api/contact", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inquiryType: "Other",
                subject: "Down",
                message: "Help"
            }),
        });
        //act
        const resp = await POST(req);
        const data = await resp.json();
        //assert
        expect(resp.status).toBe(502);
        expect(data.message).toBe("Unable to reach service");
    });
})