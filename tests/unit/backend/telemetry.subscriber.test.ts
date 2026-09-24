import { sseManager } from '../../../backend/core/src/utils/sseManager';

const redisInstances: MockRedis[] = [];

class MockRedis {
    subscribe = jest.fn().mockResolvedValue(1);
    unsubscribe = jest.fn().mockResolvedValue(0);
    quit = jest.fn().mockResolvedValue('OK');
    disconnect = jest.fn();
    handlers = new Map<string, (...args: string[]) => void>();

    constructor() {
        redisInstances.push(this);
    }

    on(event: string, handler: (...args: string[]) => void) {
        this.handlers.set(event, handler);
        return this;
    }

    emitMessage(channel: string, message: string) {
        this.handlers.get('message')?.(channel, message);
    }
}

jest.mock('ioredis', () => ({
    __esModule: true,
    default: MockRedis,
}));

jest.mock('../../../backend/core/src/utils/sseManager', () => ({
    sseManager: { broadcast: jest.fn() },
}));

import {
    startTelemetrySubscriber,
    stopTelemetrySubscriber,
} from '../../../backend/core/src/services/telemetry.subscriber';

describe('telemetry subscriber', () => {
    beforeEach(async () => {
        jest.useFakeTimers();
        await stopTelemetrySubscriber();
        redisInstances.length = 0;
        jest.clearAllMocks();
    });

    afterEach(async () => {
        await stopTelemetrySubscriber();
        jest.useRealTimers();
    });

    it('batches readings by building before broadcasting them', async () => {
        await startTelemetrySubscriber();
        const redis = redisInstances[0];
        const first = {
            building_id: 'building-1',
            sensor_id: 'sensor-1',
            power_kw: 10,
            timestamp: '2026-09-17T10:00:00.000Z',
        };
        const second = {
            building_id: 'building-1',
            sensor_id: 'sensor-2',
            power_kw: 20,
            timestamp: '2026-09-17T10:00:01.000Z',
        };

        redis.emitMessage('telemetry_channel', JSON.stringify(first));
        redis.emitMessage('telemetry_channel', JSON.stringify(second));
        expect(sseManager.broadcast).not.toHaveBeenCalled();

        jest.advanceTimersByTime(250);

        expect(sseManager.broadcast).toHaveBeenNthCalledWith(1, 'building-1', [first, second]);
        expect(sseManager.broadcast).toHaveBeenNthCalledWith(2, 'portfolio', [first, second]);
    });

    it('rejects malformed readings without scheduling a broadcast', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        await startTelemetrySubscriber();
        const redis = redisInstances[0];

        redis.emitMessage('telemetry_channel', '{bad json');
        redis.emitMessage('telemetry_channel', JSON.stringify({ building_id: 'building-1' }));
        jest.advanceTimersByTime(250);

        expect(sseManager.broadcast).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes and closes Redis during shutdown', async () => {
        await startTelemetrySubscriber();
        const redis = redisInstances[0];

        await stopTelemetrySubscriber();

        expect(redis.unsubscribe).toHaveBeenCalledWith('telemetry_channel');
        expect(redis.quit).toHaveBeenCalled();
    });
});
