/** @jest-environment node */
import {POST} from "./route";

describe("SignUp route for integration", () => {
    beforeEach(() => {
        process.env.CORE_URL = "http://core.test"
        global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: {
                            userId: "user123",
                            email: "test@test.com",
                            firstName: "John",
                            lastName: "Doe",
                            roleType: "ADMIN"
                        },
                        accessToken: "token1234"
                    }),
        }) as jest.Mock;
    });
    
    afterEach(() => { jest.clearAllMocks()});


    it("should_return_success", async() => {
        const req = new Request("http://localhost/api/login", {
            method:"POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "test@test.com",
                password: "Password@123"
            }),
        });
        //act
        const resp = await POST(req);
        const data = await resp.json();
        const [url] = (global.fetch as jest.Mock).mock.calls[0];
        //assert
        expect(resp.status).toBe(200);
        expect(data.accessToken).toBe("token1234");
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(url).toBe("http://localhost:4000/auth/login");
    });

    it("should_return_400_if_missing_stuff", async () => {
        const req = new Request("http://localhost/api/login", {
            method:"POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "test@test.com",
            }),
        });
        //act
        const resp = await POST(req);
        const data = await resp.json();
        //assert
        expect(resp.status).toBe(400);
        expect(data.message).toBe("Email and password are required fields.");
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should_return_502_for_internal_server_error", async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("failed"));
            const req = new Request("http://localhost/api/login", {
                method:"POST",
                headers:{
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: "test@test.com",
                    password: "Password@123",
                }),
            });
            //act
            const resp = await POST(req);
            const data = await resp.json();
            //assert
            expect(resp.status).toBe(502);
            expect(data.message).toBe("Unable to reach authentication service.");
        });
});