import Redis from 'ioredis';

const testRedisStore = new Map<string, string>();

const createRedisClient = () => ({
    get: async (key: string) => testRedisStore.get(key) ?? null,
    set: async (key: string, value: string) => {
        testRedisStore.set(key, value);
        return 'OK';
    },
    on: () => undefined,
    quit: async () => {
        testRedisStore.clear();
    },
});

export const redis = process.env.NODE_ENV === "test"
    ? (createRedisClient() as unknown as Redis)
    : new Redis(
        process.env.REDIS_URL
        || process.env.Redis_URL
        || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    );

if (process.env.NODE_ENV !== 'test') {
    redis.on('connect', () => {
        console.log("Successfully connected to redis");
    });
    redis.on('error', (err) => {
        console.error("Could not connect to redis:", err);
    });
}