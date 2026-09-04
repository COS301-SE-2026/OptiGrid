import { rateLimiter } from "../../../backend/core/src/middleware/rateLimiter.middleware";
import { redis } from "../../../backend/core/src/lib/redis";
import { Request, Response, NextFunction } from "express";

jest.mock("../../../backend/core/src/lib/redis", () =>({
    __esModule: true,
    redis: {
        get:jest.fn(),
        set:jest.fn(),
    }
}));

describe("Token Bucket Rate Limit Tests", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;
    let nextFunc: NextFunction;
    let statusMock: jest.Mock;
    let json: jest.Mock;
    const env = process.env;

    const mockTime = 1000000000;
    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...env };
        process.env.NODE_ENV = 'production';
        jest.spyOn(Date, "now").mockReturnValue(mockTime);
        jest.spyOn(console, "error").mockImplementation(() => {});
        json = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: json});
        process.env.DISABLE_RATE_LIMIT = "false";

        req = {
            ip: "192.168.1.100",
            baseUrl: "/api/login"
        }
        resp = {
            status: statusMock
        };
        nextFunc = jest.fn();
    });

    afterAll(() => {jest.restoreAllMocks();});

    it("should_create_a_new_bucket_when_visting_first_time", async () => {
        //arrange
        const capacity = 5;
        const refillRate = 1/60;
        (redis.get as jest.Mock).mockResolvedValue(null);
        const middleware = rateLimiter(capacity, refillRate);
        //act
        await middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(redis.get).toHaveBeenCalledWith("rateLimit:/api/login-192.168.1.100");
        expect(redis.set).toHaveBeenCalledWith(
            "rateLimit:/api/login-192.168.1.100",
            JSON.stringify({
                tokens:4,
                lastRefill: mockTime
            })
        );
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(statusMock).not.toHaveBeenCalled();
    });

    it("should_reduce_token_and_call_next_if_enough_available", async() => {
        const capacity = 5;
        const refillRate = 1/60;
        const exists ={
            tokens: 3,
            lastRefill: mockTime,
        };
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(exists));
        const middleware = rateLimiter(capacity, refillRate);
        //act
        await middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(redis.set).toHaveBeenCalledWith(
            "rateLimit:/api/login-192.168.1.100",
            JSON.stringify({
                tokens:2,
                lastRefill: mockTime
            })
        );
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(statusMock).not.toHaveBeenCalled();
    });

    it("should_not_allow_more_than_allowed_tokens_in_bucket", async () => {
        const capacity = 5;
        const refillRate = 1/60;
        const exists ={
            tokens: 2,
            lastRefill: 1000000000 - 600000, 
        };
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(exists));
        const middleware = rateLimiter(capacity, refillRate);
        //act
        await middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(redis.set).toHaveBeenCalledWith(
            "rateLimit:/api/login-192.168.1.100",
            JSON.stringify({
                tokens:4,
                lastRefill: 1000000000
            })
        );
        expect(nextFunc).toHaveBeenCalledTimes(1);
    });

    it("should_return_an_error_429_if_bucket_empty", async () => {
        const capacity = 5;
        const refillRate = 1/60;
        const exists ={
            tokens: 0,
            lastRefill: mockTime, 
        };
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(exists));
        const middleware = rateLimiter(capacity, refillRate);
        //act
        await middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(statusMock).toHaveBeenCalledWith(429);
        expect(json).toHaveBeenCalledWith({
            status: "error",
            message: "Please try again later. Too many requests"
        });
        expect(nextFunc).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it("should_be_caught_int_the_catch_block_and_return_unexpected", async () => {
        const capacity = 5;
        const refillRate = 1/60;
        (redis.get as jest.Mock).mockRejectedValue(new Error("Redis lost connection"));
        //act
        const middleware = rateLimiter(capacity, refillRate);
        //act
        await middleware(req as Request, resp as Response, nextFunc);

        //assert
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(statusMock).not.toHaveBeenCalled();
                
    });
});