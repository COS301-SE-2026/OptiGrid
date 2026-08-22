import { hostname } from 'node:os';
import type Redis from 'ioredis';
import {
    InvalidAuditEventError,
    persistAuditStreamEvent,
    type AuditLogStore,
} from '../services/auditEvent.service';


export const AUDIT_EVENT_STREAM = 'system:audit-events';
export const AUDIT_EVENT_GROUP = 'core-audit-persistence';
export const AUDIT_EVENT_DEAD_LETTER_STREAM = 'system:audit-events:dead-letter';

const DEAD_LETTER_MAXLEN = 1000;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_BLOCK_MS = 2000;
const DEFAULT_CLAIM_IDLE_MS = 60000;
const DEFAULT_RETRY_DELAY_MS = 1000;

export type AuditStreamEntry = [id: string, fields: string[]];

export interface AuditEventWorkerOptions {
    batchSize?: number;
    blockMs?: number;
    claimIdleMs?: number;
    retryDelayMs?: number;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function streamEntries(response: unknown): AuditStreamEntry[] {
    if (!Array.isArray(response)) return [];

    const entries: AuditStreamEntry[] = [];
    for (const streamResult of response) {
        if (!Array.isArray(streamResult) || !Array.isArray(streamResult[1])) continue;
        for (const entry of streamResult[1]) {
            if (
                Array.isArray(entry)
                && typeof entry[0] === 'string'
                && Array.isArray(entry[1])
            ) {
                entries.push([entry[0], entry[1] as string[]]);
            }
        }
    }
    return entries;
}

function claimedEntries(response: unknown): AuditStreamEntry[] {
    if (!Array.isArray(response) || !Array.isArray(response[1])) return [];
    return streamEntries([[AUDIT_EVENT_STREAM, response[1]]]);
}

function wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export class AuditEventWorker {
    private running = false;
    private loopPromise?: Promise<void>;
    private readonly batchSize: number;
    private readonly blockMs: number;
    private readonly claimIdleMs: number;
    private readonly retryDelayMs: number;

    constructor(
        private readonly redis: Redis,
        private readonly store: AuditLogStore,
        private readonly consumerName = `${hostname()}-${process.pid}`,
        options: AuditEventWorkerOptions = {},
    ) {
        this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
        this.blockMs = options.blockMs ?? DEFAULT_BLOCK_MS;
        this.claimIdleMs = options.claimIdleMs ?? DEFAULT_CLAIM_IDLE_MS;
        this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    }

    async ensureConsumerGroup(): Promise<void> {
        try {
            await this.redis.xgroup(
                'CREATE',
                AUDIT_EVENT_STREAM,
                AUDIT_EVENT_GROUP,
                '0',
                'MKSTREAM',
            );
        } catch (error) {
            if (!errorMessage(error).includes('BUSYGROUP')) throw error;
        }
    }

    async processEntry([streamId, fields]: AuditStreamEntry): Promise<void> {
        try {
            await persistAuditStreamEvent(this.store, fields);
        } catch (error) {
            if (error instanceof InvalidAuditEventError) {
                try {
                    await this.redis.xadd(
                        AUDIT_EVENT_DEAD_LETTER_STREAM,
                        'MAXLEN',
                        '~',
                        DEAD_LETTER_MAXLEN,
                        '*',
                        'source_stream_id',
                        streamId,
                        'reason',
                        error.message,
                        'fields',
                        JSON.stringify(fields),
                    );
                    await this.redis.xack(
                        AUDIT_EVENT_STREAM,
                        AUDIT_EVENT_GROUP,
                        streamId,
                    );
                } catch (deadLetterError) {
                    console.error(
                        '[AuditEventWorker] Could not dead-letter invalid event:',
                        deadLetterError,
                    );
                }
                return;
            }

            console.error(
                `[AuditEventWorker] Persistence failed for ${streamId}; leaving pending:`,
                error,
            );
            return;
        }

        await this.redis.xack(
            AUDIT_EVENT_STREAM,
            AUDIT_EVENT_GROUP,
            streamId,
        );
    }

    private async processEntries(entries: AuditStreamEntry[]): Promise<void> {
        for (const entry of entries) {
            await this.processEntry(entry);
        }
    }

    private async runLoop(): Promise<void> {
        let groupReady = false;

        while (this.running) {
            try {
                if (!groupReady) {
                    await this.ensureConsumerGroup();
                    groupReady = true;
                }

                const claimed = await this.redis.xautoclaim(
                    AUDIT_EVENT_STREAM,
                    AUDIT_EVENT_GROUP,
                    this.consumerName,
                    this.claimIdleMs,
                    '0-0',
                    'COUNT',
                    this.batchSize,
                );
                await this.processEntries(claimedEntries(claimed));

                const fresh = await this.redis.xreadgroup(
                    'GROUP',
                    AUDIT_EVENT_GROUP,
                    this.consumerName,
                    'COUNT',
                    this.batchSize,
                    'BLOCK',
                    this.blockMs,
                    'STREAMS',
                    AUDIT_EVENT_STREAM,
                    '>',
                );
                await this.processEntries(streamEntries(fresh));
            } catch (error) {
                if (!this.running) break;
                console.error('[AuditEventWorker] Stream processing failed:', error);
                await wait(this.retryDelayMs);
            }
        }
    }

    start(): Promise<void> {
        if (!this.loopPromise) {
            this.running = true;
            this.loopPromise = this.runLoop();
        }
        return this.loopPromise;
    }

    async stop(): Promise<void> {
        this.running = false;
        this.redis.disconnect();
        await this.loopPromise;
    }
}
