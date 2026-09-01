import Redis from 'ioredis';

export const redis = new Redis(
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