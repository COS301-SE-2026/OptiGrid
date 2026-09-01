import type Redis from 'ioredis';
import {
    AUDIT_EVENT_DEAD_LETTER_STREAM,
    AUDIT_EVENT_GROUP,
    AUDIT_EVENT_STREAM,
    AuditEventWorker,
    type AuditStreamEntry,
} from '../../../backend/core/src/workers/auditEvent.worker';
import type { AuditLogStore } from '../../../backend/core/src/services/auditEvent.service';


const EVENT_ID = 'd79b00b4-2506-48c2-903b-fbb147895758';

function validEntry(): AuditStreamEntry {
    return [
        '1724335500000-0',
        [
            'event_id', EVENT_ID,
            'action_type', 'SYSTEM_FAILURE',
            'target_table', 'energy_telemetry',
            'service', 'ingestion-worker',
            'operation', 'write-to-influx',
            'severity', 'error',
            'error_code', 'INFLUX_WRITE_FAILED',
            'message', 'Connection refused',
            'timestamp', '2026-08-22T14:05:00+00:00',
        ],
    ];
}

function dependencies() {
    const redis = {
        xack: jest.fn(),
        xadd: jest.fn(),
        xgroup: jest.fn(),
        disconnect: jest.fn(),
    } as unknown as Redis;
    const store = {
        auditLog: {
            create: jest.fn(),
        },
    } as unknown as AuditLogStore;
    return { redis, store };
}

describe('AuditEventWorker', () => {
    it('acknowledges an event only after postgres persistence succeeds', async () => {
        const { redis, store } = dependencies();
        const worker = new AuditEventWorker(redis, store, 'test-consumer');

        await worker.processEntry(validEntry());

        expect(store.auditLog.create).toHaveBeenCalledTimes(1);
        expect(redis.xack).toHaveBeenCalledWith(
            AUDIT_EVENT_STREAM,
            AUDIT_EVENT_GROUP,
            '1724335500000-0',
        );
    });

    it('leaves an event pending when postgres persistence fails', async () => {
        const { redis, store } = dependencies();
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        (store.auditLog.create as jest.Mock).mockRejectedValue(
            new Error('Postgres unavailable'),
        );
        const worker = new AuditEventWorker(redis, store, 'test-consumer');

        await worker.processEntry(validEntry());

        expect(redis.xack).not.toHaveBeenCalled();
        expect(redis.xadd).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
    });

    it('dead-letters and acknowledges malformed events', async () => {
        const { redis, store } = dependencies();
        const invalidEntry = validEntry();
        invalidEntry[1][1] = 'not-a-uuid';
        const worker = new AuditEventWorker(redis, store, 'test-consumer');

        await worker.processEntry(invalidEntry);

        expect(store.auditLog.create).not.toHaveBeenCalled();
        expect(redis.xadd).toHaveBeenCalledWith(
            AUDIT_EVENT_DEAD_LETTER_STREAM,
            'MAXLEN',
            '~',
            1000,
            '*',
            'source_stream_id',
            '1724335500000-0',
            'reason',
            'Invalid audit event',
            'fields',
            JSON.stringify(invalidEntry[1]),
        );
        expect(redis.xack).toHaveBeenCalledWith(
            AUDIT_EVENT_STREAM,
            AUDIT_EVENT_GROUP,
            '1724335500000-0',
        );
    });

    it('accepts an already-created consumer group', async () => {
        const { redis, store } = dependencies();
        (redis.xgroup as jest.Mock).mockRejectedValue(
            new Error('BUSYGROUP Consumer Group name already exists'),
        );
        const worker = new AuditEventWorker(redis, store, 'test-consumer');

        await expect(worker.ensureConsumerGroup()).resolves.toBeUndefined();
    });
});
