import { checkIdempotencyKey, saveIdempotencyKey } from "../../../backend/core/src/services/idempotency.services";
import { redis } from "../../../backend/core/src/lib/redis";

jest.mock("../../../backend/core/src/lib/redis", () => ({
    redis: {
        get: jest.fn(),
        set: jest.fn(),
    },
}));

describe("Idempotency Service unit tests", () => {
    const userId = "user123";
    const key = "key-123";
    const redisKey = `idempotency:${userId}:${key}`;
    const resp = {
        success: true,
        buildingId: "building-123"
    };

    beforeEach(() => {jest.clearAllMocks()});
    
    it("should_return_json_data_if_key_in_reids", async () => {
        (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(resp));
        //act
        const out = await checkIdempotencyKey(userId, key);
        //assert
        expect(redis.get).toHaveBeenCalledWith(redisKey);
        expect(out).toEqual(resp);
    });
    
    it("should_return_null_when_not_in_redis", async () => {
        (redis.get as jest.Mock).mockResolvedValue(null);
        //act
        const out = await checkIdempotencyKey(userId, key);
        //assert
        expect(out).toBeNull();
    });

    it("should_return_the_error_int_the_catch_block", async () => {
        const err = new Error("Some error");
        (redis.get as jest.Mock).mockRejectedValueOnce(err);
        //act
        const out = await checkIdempotencyKey(userId, key);
        //assert
        expect(out).toBeNull();
        
    });

    it("should_save_data_with_24hour_ttl", async () => {
        (redis.set as jest.Mock).mockResolvedValueOnce('OK');
        //act
        await saveIdempotencyKey(userId, key, resp);
        //assert
        expect(redis.set).toHaveBeenCalledWith(redisKey,
            JSON.stringify(resp), "EX", 86400
        );
    });

    it("should_log_warning_if_save_fail", async () => {
        const err = new Error("Some error");
        (redis.get as jest.Mock).mockRejectedValueOnce(err);
        //act n assert
        await expect(saveIdempotencyKey(userId, key, resp)).resolves.toBeUndefined();
    });
});