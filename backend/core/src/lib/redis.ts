import Redis from 'ioredis';

export const redis = new Redis(process.env.Redis_URL || 'redis://localhost:6379');
//successfull and unsuccessful connection handler
redis.on('connect', () => {
    console.log('Successfully connected to Redis.');
});
redis.on('error', (err) => {
    console.error('Redis connection error:', err);
});

