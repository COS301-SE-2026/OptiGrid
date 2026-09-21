import Redis from 'ioredis';

let redisInstance: any;

const createTestRedis = (): any => {
    const store = new Map<string, string>();
    const client: any = {
        on: () => client,
        get: async (k: string) => store.get(k) || null,
        mget: async (...keys: string[]) => keys.map(k => store.get(k) || null),
        set: async (k: string, v: string) => { store.set(k, v); return "OK"; },
        keys: async (pattern: string) => Array.from(store.keys()),
        del: async (...keys: string[]) => {
            let deleted = 0;
            for (const key of keys) { if (store.delete(key)) deleted++; }
            return deleted;
        },
        pipeline: () => {
            const p: any = {
                del: (...keys: string[]) => {
                    for (const key of keys) store.delete(key);
                    return p;
                },
                set: (key: string, value: string, ...opts: any[]) => {
                    store.set(key, value);
                    return p;
                },
                exec: async () => []
            };
            return p;
        },
        subscribe: async (channel: string, callback?: (err: Error | null, count: number) => void) => {
            callback?.(null, 1);
            return 1;
        },
        unsubscribe: async () => 0,
        publish: async () => 0,
        ping: async () => "PONG",
        llen: async () => 0,
        xadd: async () => "0-0",
        xgroup: async () => "OK",
        xreadgroup: async () => null,
        xack: async () => 0,
        xautoclaim: async () => ["0-0", []],
        duplicate: () => createTestRedis(),
        disconnect: () => {},
        quit: async () => { store.clear(); return "OK"; }
    };
    return client;
};

if (process.env.NODE_ENV === 'test') {
    redisInstance = createTestRedis();
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