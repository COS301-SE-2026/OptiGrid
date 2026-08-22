import { AuditSeverity } from '@prisma/client';
import {
    InvalidAuditEventError,
    persistAuditStreamEvent,
    type AuditLogStore,
} from '../../../backend/core/src/services/auditEvent.service';


const EVENT_ID = 'd79b00b4-2506-48c2-903b-fbb147895758';
const BUILDING_ID = 'cb430d07-abbb-4c9d-b32a-85b47dfbc5ea';
const USER_ID = '1b4c979f-e6c8-4118-aae4-51751d3cb63c';

function validFields(): string[] {
    return [
        'event_id', EVENT_ID,
        'action_type', 'SYSTEM_FAILURE',
        'target_table', 'energy_telemetry',
        'service', 'ingestion-worker',
        'operation', 'write-to-influx',
        'severity', 'error',
        'error_code', 'INFLUX_WRITE_FAILED',
        'message', 'Connection refused',
        'timestamp', '2026-08-22T14:05:00+00:00',
        'building_id', BUILDING_ID,
        'user_id', USER_ID,
        'sensor_id', 'sensor-001',
        'request_id', 'request-001',
        'metadata', '{"observer":"InfluxStorageObserver"}',
    ];
}

function mockStore() {
    return {
        auditLog: {
            create: jest.fn(),
        },
    } as unknown as AuditLogStore;
}

describe('audit event persistence', () => {
    it('maps a stream event into a structured audit record', async () => {
        const store = mockStore();

        const result = await persistAuditStreamEvent(store, validFields());

        expect(result).toBe('created');
        expect(store.auditLog.create).toHaveBeenCalledWith({
            data: {
                log_id: EVENT_ID,
                user_id: USER_ID,
                building_id: BUILDING_ID,
                action_type: 'SYSTEM_FAILURE',
                target_table: 'energy_telemetry',
                service: 'ingestion-worker',
                operation: 'write-to-influx',
                severity: AuditSeverity.ERROR,
                error_code: 'INFLUX_WRITE_FAILED',
                request_id: 'request-001',
                metadata: {
                    observer: 'InfluxStorageObserver',
                    message: 'Connection refused',
                    sensor_id: 'sensor-001',
                },
                timestamp: new Date('2026-08-22T14:05:00+00:00'),
            },
        });
    });

    it('treats an existing event id as an idempotent duplicate', async () => {
        const store = mockStore();
        (store.auditLog.create as jest.Mock).mockRejectedValue({ code: 'P2002' });

        await expect(persistAuditStreamEvent(store, validFields()))
            .resolves.toBe('duplicate');
    });

    it('rejects malformed events before writing to postgres', async () => {
        const store = mockStore();
        const fields = validFields();
        fields[1] = 'not-a-uuid';

        await expect(persistAuditStreamEvent(store, fields))
            .rejects.toBeInstanceOf(InvalidAuditEventError);
        expect(store.auditLog.create).not.toHaveBeenCalled();
    });

    it('rejects non-object metadata', async () => {
        const store = mockStore();
        const fields = validFields();
        fields[fields.indexOf('metadata') + 1] = '[]';

        await expect(persistAuditStreamEvent(store, fields))
            .rejects.toThrow('Audit event metadata must be an object');
    });

    it('rejects events whose user or building reference does not exist', async () => {
        const store = mockStore();
        (store.auditLog.create as jest.Mock).mockRejectedValue({ code: 'P2003' });

        await expect(persistAuditStreamEvent(store, validFields()))
            .rejects.toThrow('Audit event references an unknown user or building');
    });
});
