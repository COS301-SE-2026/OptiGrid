import Redis from 'ioredis';

const createRedisClient = () => ({
    get: async () => null,
    set: async () => 'OK',
    on: () => undefined,
    quit: async () => undefined,
});

export const redis = process.env.NODE_ENV === 'test'
    ? (createRedisClient() as unknown as Redis)
    : new Redis(process.env.Redis_URL || 'redis://localhost:6379');

if (process.env.NODE_ENV !== 'test') {
    redis.on('connect', () => {
        console.log('Successfully connected to Redis.');
    });
    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
    });
}

