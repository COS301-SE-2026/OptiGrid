/** @jest-environment node */
import {POST} from "./route";

describe("SignUp route for integration", () => {
    beforeEach(() => {
        process.env.CORE_URL = "http://core.test"
        global.fetch = jest.fn().mockImplementation(async(url:string) => {
            const urlString = url?.toString() || "";
            if(urlString.includes("auth/signup")) {
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({
                        message: "User created successfully"
                    }),
                };
            }
            if(urlString.includes("auth/login")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        user: {
                            userId: "user123",
                            email: "test@test.com",
                            firstName: "John",
                            lastName: "Doe"
                        },
                        accessToken: "token1234"
                    }),
                };
            } 
        }) as jest.Mock;
    });
    
    afterEach(() => { jest.clearAllMocks()});

    it("should_pass_stuff_to_core_and_login", async () => {
        const req = new Request("http://localhost/api/signup", {
            method:"POST",
            headers:{
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "test@test.com",
                password: "Password!123",
                firstName: "John",
                lastName: "Doe"
            }),
        });
        //act
        const resp = await POST(req);
        const data = await resp.json();
        //assert
        expect(resp.status).toBe(201);
        expect(data.accessToken).toBe("token1234");
        expect(global.fetch).toHaveBeenCalledTimes(2);
        const [signupUrl, signupOpt] = (global.fetch as jest.Mock).mock.calls[0];
        expect(signupUrl).toBe("http://localhost:4000/auth/signup");
        expect(signupOpt.body).toContain("John Doe");
    });

    it("should_return_error_400_if_stuff_missing", async () => {
        const req = new Request("http://localhost/api/signup", {
            method:"POST",
            headers:{
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
        expect(data.message).toBe("Email, password, and name are required fields.");
        expect(global.fetch).not.toHaveBeenCalled();
    }) ;

    it("should_return_502_for_internal_server_error", async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("failed"));
        const req = new Request("http://localhost/api/signup", {
            method:"POST",
            headers:{
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: "test@test.com",
                password: "Password@123",
                firstName: "John",
                lastName: "Doe"
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