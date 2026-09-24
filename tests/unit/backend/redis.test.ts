import redis from "ioredis";

jest.mock("ioredis", () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn(),
    }));
});

describe("Redis file Unit Tests", () => {
    const env = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...env};
    });
    afterEach(() => {jest.restoreAllMocks();});
    afterAll(() => {process.env = env});

    it("should_hand_get_set_quit_when_in_test_mode", async () => {
        process.env.NODE_ENV = "test";
        const {redis: red} =require("../../../backend/core/src/lib/redis");
        const mockRedis = require("ioredis");
        expect(mockRedis).not.toHaveBeenCalled();
        //act and assert
        await expect(red.set("key", "test")).resolves.toBe("OK");
        await expect(red.get("key")).resolves.toBe("test");
        await red.quit();
        await expect(red.get("key")).resolves.toBeNull();
    });

    it("should_initialise_ioredis_when_not_in_test_with_the_given_url", async () => {
        process.env.NODE_ENV = "production";
        process.env.REDIS_URL = "redis://test:6379";
        //act
        require("../../../backend/core/src/lib/redis");
        const mockRedis = require("ioredis");
        //assert
        expect(mockRedis).toHaveBeenCalledTimes(1);
        expect(mockRedis).toHaveBeenCalledWith("redis://test:6379");
    });

    it("shoul_fallback_to_placehodlers", async ()=> {
        process.env.NODE_ENV = "development";
        delete process.env.REDIS_URL;
        process.env.REDIS_HOST = "test";
        process.env.REDIS_PORT = "6380";
        //act
        require("../../../backend/core/src/lib/redis");
        const mockRedis = require("ioredis");
        //assert
        expect(mockRedis).toHaveBeenCalledWith("redis://test:6380");
    });

    it("should_send_success_msg_if_connect_event_tried", async ()=> {
        const spy = jest.spyOn(console, 'log').mockImplementation();
        process.env.NODE_ENV = "production";
        //act
        const {redis: red} = require("../../../backend/core/src/lib/redis");
        expect(red.on).toHaveBeenCalledWith("connect", expect.any(Function));
        const callback = (red.on as jest.Mock).mock.calls.find(
            (call) => call[0] === "connect"
        )[1];
        callback();
        //assert
        expect(spy).toHaveBeenCalledWith("Successfully connected to redis");
        spy.mockRestore();
    });

    it("should_send_error_msg_if_error_event_tried", async ()=> {
        const spy = jest.spyOn(console, 'error').mockImplementation();
        process.env.NODE_ENV = "production";
        //act
        const {redis: red} = require("../../../backend/core/src/lib/redis");
        expect(red.on).toHaveBeenCalledWith("error", expect.any(Function));
        const callback = (red.on as jest.Mock).mock.calls.find(
            (call) => call[0] === "error"
        )[1];

        const err = new Error("failure");
        callback(err);
        //assert
        expect(spy).toHaveBeenCalledWith("Could not connect to redis:", err);
        spy.mockRestore();
    });
});