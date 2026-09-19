import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { queryUsageBetween, resolveCostZar } from '../lib/influx';
import { computeRecordHash, GENESIS_HASH, HASH_ALGORITHM, type ChainableAuditRecord } from '../lib/hashChain';

const BATCH_SIZE = 500;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface ReportingPeriod {
    start: Date;
    endExclusive: Date;
    days: number;
    label: string;
}

export const previousCalendarMonth = (reference: Date): ReportingPeriod => {
    const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1));
    const endExclusive = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));

    return {
        start,
        endExclusive,
        days: Math.round((endExclusive.getTime() - start.getTime()) / DAY_IN_MS),
        label: `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`
    };
};

export interface ChainBreak {
    log_id: string;
    chain_index: string;
    timestamp: string | null;
    reason: 'prev_hash_mismatch' | 'content_mismatch' | 'missing_hash';
}

export interface ChainVerification {
    verified: boolean;
    algorithm: string;
    records_checked: number;
    current_hash: string | null;
    chain_started_at: string | null;
    chain_updated_at: string | null;
    broken_at: ChainBreak | null;
    verified_at: string;
}

const chainSelect = {
    log_id: true,
    user_id: true,
    building_id: true,
    action_type: true,
    target_table: true,
    service: true,
    operation: true,
    severity: true,
    error_code: true,
    request_id: true,
    old_value: true,
    new_value: true,
    metadata: true,
    ip_address: true,
    timestamp: true,
    chain_index: true,
    prev_hash: true,
    current_hash: true
} as const;

type ChainRow = {
    [K in keyof typeof chainSelect]: unknown;
};

const toChainableRecord = (row: ChainRow): ChainableAuditRecord => ({
    log_id: String(row.log_id),
    user_id: (row.user_id as string | null) ?? null,
    building_id: (row.building_id as string | null) ?? null,
    action_type: String(row.action_type),
    target_table: String(row.target_table),
    service: (row.service as string | null) ?? null,
    operation: (row.operation as string | null) ?? null,
    severity: row.severity === null || row.severity === undefined ? null : String(row.severity),
    error_code: (row.error_code as string | null) ?? null,
    request_id: (row.request_id as string | null) ?? null,
    old_value: row.old_value ?? null,
    new_value: row.new_value ?? null,
    metadata: row.metadata ?? null,
    ip_address: (row.ip_address as string | null) ?? null,
    timestamp: (row.timestamp as Date | null) ?? null
});

const toIso = (value: unknown): string | null => {
    if (!value) {
        return null;
    }

    const parsedValue = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsedValue.getTime())) {
        return null;
    } 
    else {
        return parsedValue.toISOString();
    }
};

export const verifyAuditChain = async (): Promise<ChainVerification> => {
    let previousHash = GENESIS_HASH;
    let recordsChecked = 0;
    let cursor: bigint | null = null;
    let brokenAt: ChainBreak | null = null;
    let chainStartedAt: string | null = null;
    let chainUpdatedAt: string | null = null;

    for (; ;) {
        const batch = await prisma.auditLog.findMany({
            where: {
                chain_index: cursor === null ? { not: null } : { gt: cursor }
            },
            orderBy: { chain_index: 'asc' },
            take: BATCH_SIZE,
            select: chainSelect
        }) as unknown as ChainRow[];

        if (batch.length === 0) break;

        for (const row of batch) {
            const storedHash = row.current_hash as string | null;
            const storedPrev = row.prev_hash as string | null;
            const timestamp = toIso(row.timestamp);

            if (recordsChecked === 0) {
                chainStartedAt = timestamp;
            }

            if (!storedHash || !storedPrev) {
                brokenAt = {
                    log_id: String(row.log_id),
                    chain_index: String(row.chain_index),
                    timestamp,
                    reason: 'missing_hash'
                };
                break;
            }

            if (storedPrev !== previousHash) {
                brokenAt = {
                    log_id: String(row.log_id),
                    chain_index: String(row.chain_index),
                    timestamp,
                    reason: 'prev_hash_mismatch'
                };
                break;
            }

            if (computeRecordHash(toChainableRecord(row), storedPrev) !== storedHash) {
                brokenAt = {
                    log_id: String(row.log_id),
                    chain_index: String(row.chain_index),
                    timestamp,
                    reason: 'content_mismatch'
                };
                break;
            }

            previousHash = storedHash;
            chainUpdatedAt = timestamp;
            recordsChecked += 1;
            cursor = BigInt(String(row.chain_index));
        }

        if (brokenAt || batch.length < BATCH_SIZE) break;
    }

    return {
        verified: brokenAt === null && recordsChecked > 0,
        algorithm: HASH_ALGORITHM,
        records_checked: recordsChecked,
        current_hash: recordsChecked > 0 ? previousHash : null,
        chain_started_at: chainStartedAt,
        chain_updated_at: chainUpdatedAt,
        broken_at: brokenAt,
        verified_at: new Date().toISOString()
    };
};

export interface ComplianceReport {
    standard: string;
    report_type: string;
    generated_at: string;
    period: { label: string; start: string; end: string; days: number };
    organisation: {
        buildings_in_scope: number;
        total_floor_area_sqft: number | null;
        sites: {
            building_id: string;
            name: string;
            type: string | null;
            usage_kwh: number | null;
            cost_zar: number | null;
            share_of_total: number | null;
        }[];
    };
    energy_performance: {
        total_usage_kwh: number;
        total_cost_zar: number;
        average_daily_kwh: number;
        intensity_kwh_per_sqft: number | null;
    };
    significant_energy_users: {
        building_id: string;
        name: string;
        usage_kwh: number | null;
        share_of_total: number | null;
    }[];
    nonconformities: {
        total: number;
        open: number;
        resolved: number;
        by_severity: Record<string, number>;
    };
    corrective_actions: {
        total: number;
        implemented: number;
        pending: number;
        estimated_monthly_saving_zar: number;
    };
    audit_trail: {
        entries_in_period: number;
        total_chained_entries: number;
        integrity: ChainVerification;
    };
    digital_signature: {
        algorithm: string;
        value: string | null;
        records_covered: number;
        signed_at: string;
    };
}

export const buildComplianceReport = async (allowedBuildingIds: string[]): Promise<ComplianceReport> => {
    const generatedAt = new Date();
    const period = previousCalendarMonth(generatedAt);
    const periodStart = period.start;
    const periodEnd = new Date(period.endExclusive.getTime() - 1);
    const buildings = await prisma.building.findMany({
        where: { building_id: { in: allowedBuildingIds } }
    });

    const usageByBuilding = new Map<string, { kwh: number | null; cost: number | null }>();
    await Promise.all(buildings.map(async (building) => {
        try {
            const usage = await queryUsageBetween(building.building_id, period.start, period.endExclusive);
            const kwh = typeof usage === 'number' ? usage : usage?.total_kwh ?? null;
            const cost = typeof usage === 'number' ? null : resolveCostZar(Number(usage?.total_cost_zar ?? 0), Number(usage?.total_cost_usd ?? 0), Number(usage?.total_kwh ?? 0));
            usageByBuilding.set(building.building_id, { kwh, cost });
        } 
        catch (error) {
            console.error(`[Compliance] usage lookup failed for ${building.building_id}:`, error);
            usageByBuilding.set(building.building_id, { kwh: null, cost: null });
        }
    }));

    const anomalies = await prisma.anomaly.findMany({
        where: {
            building_id: { 
                in: allowedBuildingIds 
            },
            detected_timestamp: { 
                gte: periodStart, 
                lte: periodEnd 
            }
        },
        select: { 
            severity_level: true, 
            status: true 
        }
    });

    const recommendations = await prisma.$queryRaw<{ status: string | null; estimated_monthly_savings: unknown }[]>(Prisma.sql
        `SELECT status::text AS status, estimated_monthly_savings
         FROM public.optimisation_recommendations
         WHERE "building_id"::text IN (${Prisma.join(allowedBuildingIds)}) AND "generated_date" >= ${periodStart}AND "generated_date" <= ${periodEnd}`
    ).catch(() => []);

    const entriesInPeriod = await prisma.auditLog.count({
        where: { 
            timestamp: 
            { 
                gte: periodStart, 
                lte: periodEnd 
            } 
    }
    });

    const totalChainedEntries = await prisma.auditLog.count({
        where: 
        { 
            chain_index: { 
                not: null 
            } 
        }
    });

    const integrity = await verifyAuditChain();
    const totalUsage = buildings.reduce((sum, building) => sum + (usageByBuilding.get(building.building_id)?.kwh ?? 0), 0);
    const totalCost = buildings.reduce((sum, building) => sum + (usageByBuilding.get(building.building_id)?.cost ?? 0), 0);
    const totalFloorArea = buildings.reduce((sum, building) => sum + (building.square_footage ? Number(building.square_footage) : 0), 0);

    const shareOf = (value: number | null): number | null => {
        if (value === null || totalUsage <= 0){ 
            return null;
        }
        return Number(((value / totalUsage) * 100).toFixed(2));
    };

    const sites = buildings.map((building) => {
            const usage = usageByBuilding.get(building.building_id);
            return {
                building_id: building.building_id,
                name: building.building_name,
                type: building.building_type ? String(building.building_type) : null,
                usage_kwh: usage?.kwh ?? null,
                cost_zar: usage?.cost ?? null,
                share_of_total: shareOf(usage?.kwh ?? null)
            };
    }).sort((a, b) => (b.usage_kwh ?? -1) - (a.usage_kwh ?? -1));

    const severityCounts: Record<string, number> = {};
    let openAnomalies = 0;
    let resolvedAnomalies = 0;
    for (const anomaly of anomalies) {
        const severity = (anomaly.severity_level ?? 'unspecified').toLowerCase();
        severityCounts[severity] = (severityCounts[severity] ?? 0) + 1;
        const status = String(anomaly.status ?? '').toLowerCase();
        if (status === 'resolved' || status === 'ignored') {
            resolvedAnomalies += 1;
        } else {
            openAnomalies += 1;
        }
    }

    const statusOf = (value: unknown): string => String(value ?? '').toLowerCase();
    const implemented = recommendations.filter((row) => statusOf(row.status) === 'implemented').length;
    const pending = recommendations.filter((row) => statusOf(row.status) === 'pending' || statusOf(row.status) === 'pending_execution').length;
    const pendingSaving = recommendations.filter((row) => statusOf(row.status) === 'pending' || statusOf(row.status) === 'pending_execution').reduce((sum, row) => sum + (Number(row.estimated_monthly_savings) || 0), 0);

    return {
        standard: 'ISO 50001:2018',
        report_type: 'Energy management compliance summary',
        generated_at: generatedAt.toISOString(),
        period: {
            label: period.label,
            start: periodStart.toISOString(),
            end: periodEnd.toISOString(),
            days: period.days
        },
        organisation: {
            buildings_in_scope: buildings.length,
            total_floor_area_sqft: totalFloorArea > 0 ? totalFloorArea : null,
            sites
        },
        energy_performance: {
            total_usage_kwh: Number(totalUsage.toFixed(2)),
            total_cost_zar: Number(totalCost.toFixed(2)),
            average_daily_kwh: Number((totalUsage / period.days).toFixed(2)),
            intensity_kwh_per_sqft: totalFloorArea > 0 ? Number((totalUsage / totalFloorArea).toFixed(4)) : null
        },
        significant_energy_users: sites.slice(0, 5).map((site) => ({
            building_id: site.building_id,
            name: site.name,
            usage_kwh: site.usage_kwh,
            share_of_total: site.share_of_total
        })),
        nonconformities: {
            total: anomalies.length,
            open: openAnomalies,
            resolved: resolvedAnomalies,
            by_severity: severityCounts
        },
        corrective_actions: {
            total: recommendations.length,
            implemented,
            pending,
            estimated_monthly_saving_zar: Number(pendingSaving.toFixed(2))
        },
        audit_trail: {
            entries_in_period: entriesInPeriod,
            total_chained_entries: totalChainedEntries,
            integrity
        },
        digital_signature: {
            algorithm: HASH_ALGORITHM,
            value: integrity.current_hash,
            records_covered: integrity.records_checked,
            signed_at: generatedAt.toISOString()
        }
    };
};