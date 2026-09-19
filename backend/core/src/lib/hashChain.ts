import { createHash } from 'crypto';

export const HASH_ALGORITHM = 'SHA-256';
export const GENESIS_HASH = '0'.repeat(64);

export interface ChainableAuditRecord {
    log_id: string;
    user_id: string | null;
    building_id: string | null;
    action_type: string;
    target_table: string;
    service: string | null;
    operation: string | null;
    severity: string | null;
    error_code: string | null;
    request_id: string | null;
    old_value: unknown;
    new_value: unknown;
    metadata: unknown;
    ip_address: string | null;
    timestamp: Date | string | null;
}

const canonicaliseData = (value: unknown): string => {
    if (value === null || value === undefined) {
        return 'null';
    }

    if (Array.isArray(value)) {
        return `[${value.map(canonicaliseData).join(',')}]`;
    }

    if (value instanceof Date) {
        return JSON.stringify(value.toISOString());
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, entryValue]) => entryValue !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicaliseData(entryValue)}`);
        return `{${entries.join(',')}}`;
    }

    return JSON.stringify(value);
};

const normaliseTimestamp = (value: Date | string | null): string | null => {
    if (value === null || value === undefined) {
        return null;
    }
    const parsedValue = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsedValue.getTime()) ? null : parsedValue.toISOString();
};

const normaliseIdentifier = (value: string | null): string | null => value === null ? null : value.toLowerCase();

export const buildRecordPayload = (record: ChainableAuditRecord): string =>
    canonicaliseData({
        log_id: normaliseIdentifier(record.log_id),
        user_id: normaliseIdentifier(record.user_id ?? null),
        building_id: normaliseIdentifier(record.building_id ?? null),
        action_type: record.action_type,
        target_table: record.target_table,
        service: record.service ?? null,
        operation: record.operation ?? null,
        severity: record.severity ?? null,
        error_code: record.error_code ?? null,
        request_id: record.request_id ?? null,
        old_value: record.old_value ?? null,
        new_value: record.new_value ?? null,
        metadata: record.metadata ?? null,
        ip_address: record.ip_address ?? null,
        timestamp: normaliseTimestamp(record.timestamp ?? null)
    });

export const computeRecordHash = (record: ChainableAuditRecord, previousHash: string): string =>
    createHash('sha256').update(`${previousHash}\n${buildRecordPayload(record)}`).digest('hex');

export const isHashFormat = (value: unknown): value is string =>
    typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);