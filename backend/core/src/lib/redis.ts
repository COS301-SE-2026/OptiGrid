import Redis from 'ioredis';

let redisInstance: any;

if (process.env.NODE_ENV === 'test') {
    const store = new Map();
    redisInstance = {
        on: () => {},
        get: async (k: string) => store.get(k) || null,
        set: async (k: string, v: string) => { store.set(k, v); return "OK"; },
        quit: async () => { store.clear(); }
    };
} else {
    redisInstance = new Redis(
        process.env.REDIS_URL || process.env.Redis_URL
        || `redis://${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
    );

    redisInstance.on('connect', () => {
        console.log("Successfully connected to redis");
    });
    redisInstance.on('error', (err: any) => {
        console.error("Could not connect to redis:", err);
    });
}

export const redis = redisInstance;