import {
    AuditSeverity,
    type Prisma,
    type PrismaClient,
} from '@prisma/client';
import { z } from 'zod';


const auditEventSchema = z.object({
    event_id: z.string().uuid(),
    action_type: z.literal('SYSTEM_FAILURE'),
    target_table: z.string().min(1).max(255),
    service: z.string().min(1).max(100),
    operation: z.string().min(1).max(100),
    severity: z.enum(['info', 'warning', 'error', 'critical']),
    error_code: z.string().min(1).max(100),
    message: z.string().min(1).max(1000),
    timestamp: z.string().refine(
        value => !Number.isNaN(Date.parse(value)),
        'timestamp must be an ISO-8601 date',
    ),
    building_id: z.string().uuid().optional(),
    user_id: z.string().uuid().optional(),
    sensor_id: z.string().max(255).optional(),
    request_id: z.string().max(128).optional(),
    metadata: z.string().max(16384).optional(),
});

const severityMap = {
    info: AuditSeverity.INFO,
    warning: AuditSeverity.WARNING,
    error: AuditSeverity.ERROR,
    critical: AuditSeverity.CRITICAL,
} as const;

type AuditLogStore = Pick<PrismaClient, 'auditLog'>;
type PersistResult = 'created' | 'duplicate';


export class InvalidAuditEventError extends Error {
    constructor(message = 'Invalid audit event') {
        super(message);
        this.name = 'InvalidAuditEventError';
    }
}

function fieldsToRecord(fields: string[]): Record<string, string> {
    if (fields.length % 2 !== 0) {
        throw new InvalidAuditEventError('Audit event fields must be key/value pairs');
    }

    const event: Record<string, string> = {};
    for (let index = 0; index < fields.length; index += 2) {
        event[fields[index]] = fields[index + 1];
    }
    return event;
}

function parseMetadata(value?: string): Record<string, unknown> {
    if (!value) return {};

    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new InvalidAuditEventError('Audit event metadata must be an object');
        }
        return parsed as Record<string, unknown>;
    } catch (error) {
        if (error instanceof InvalidAuditEventError) throw error;
        throw new InvalidAuditEventError('Audit event metadata must be valid JSON');
    }
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === code;
}

export async function persistAuditStreamEvent(
    store: AuditLogStore,
    fields: string[],
): Promise<PersistResult> {
    const parsed = auditEventSchema.safeParse(fieldsToRecord(fields));
    if (!parsed.success) {
        throw new InvalidAuditEventError();
    }

    const event = parsed.data;
    const eventMetadata = parseMetadata(event.metadata);
    const metadata = {
        ...eventMetadata,
        message: event.message,
        ...(event.sensor_id ? { sensor_id: event.sensor_id } : {}),
    } as Prisma.InputJsonObject;

    try {
        await store.auditLog.create({
            data: {
                log_id: event.event_id,
                user_id: event.user_id ?? null,
                building_id: event.building_id ?? null,
                action_type: event.action_type,
                target_table: event.target_table,
                service: event.service,
                operation: event.operation,
                severity: severityMap[event.severity],
                error_code: event.error_code,
                request_id: event.request_id ?? null,
                metadata,
                timestamp: new Date(event.timestamp),
            },
        });
        return 'created';
    } catch (error) {
        if (isPrismaErrorCode(error, 'P2002')) return 'duplicate';
        if (isPrismaErrorCode(error, 'P2003')) {
            throw new InvalidAuditEventError(
                'Audit event references an unknown user or building',
            );
        }
        throw error;
    }
}

export type { AuditLogStore, PersistResult };
