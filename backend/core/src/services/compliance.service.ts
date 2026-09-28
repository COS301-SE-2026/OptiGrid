import { createHash } from 'crypto';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { queryUsageBetween, resolveCostZar } from '../lib/influx';
import { computeRecordHash, GENESIS_HASH, HASH_ALGORITHM, toChainableAuditRecord } from '../lib/hashChain';
import { verifyCarbonLedgerMonth, type CarbonIntegrityResult } from './carbonIntegrity.service';

// Keep memory bounded while avoiding dozens of network round trips for mature ledgers.
const BATCH_SIZE = 2_000;
const COMPLIANCE_TELEMETRY_TIMEOUT_MS = 5_000;
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
    verification_status: 'NOT_RUN' | 'VERIFIED' | 'FAILED';
    algorithm: string;
    records_checked: number;
    current_hash: string | null;
    chain_started_at: string | null;
    chain_updated_at: string | null;
    broken_at: ChainBreak | null;
    verified_at: string | null;
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

            if (computeRecordHash(toChainableAuditRecord(row), storedPrev) !== storedHash) {
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
        verification_status: brokenAt === null && recordsChecked > 0 ? 'VERIFIED' : 'FAILED',
        algorithm: HASH_ALGORITHM,
        records_checked: recordsChecked,
        current_hash: recordsChecked > 0 ? previousHash : null,
        chain_started_at: chainStartedAt,
        chain_updated_at: chainUpdatedAt,
        broken_at: brokenAt,
        verified_at: new Date().toISOString()
    };
};

const getAuditChainSnapshot = async (): Promise<ChainVerification> => {
    const latestEntry = await prisma.auditLog.findFirst({
        where: { chain_index: { not: null } },
        orderBy: { chain_index: 'desc' },
        select: {
            current_hash: true,
            timestamp: true
        }
    });

    return {
        verified: false,
        verification_status: 'NOT_RUN',
        algorithm: HASH_ALGORITHM,
        records_checked: 0,
        current_hash: latestEntry?.current_hash ?? null,
        chain_started_at: null,
        chain_updated_at: toIso(latestEntry?.timestamp),
        broken_at: null,
        verified_at: null
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
            carbon_kg_co2e: number | null;
            share_of_total: number | null;
        }[];
    };
    carbon_accounting: {
        total_kg_co2e: number | null;
        ledger_entries: number;
        expected_entries: number;
        source_complete_entries: number;
        source_incomplete_entries: number;
        missing_entries: number;
        scope_status: 'VALID' | 'TAMPERED' | 'INCOMPLETE';
        buildings: CarbonIntegrityResult[];
    };
    energy_performance: {
        total_usage_kwh: number;
        total_cost_zar: number | null;
        average_daily_kwh: number;
        intensity_kwh_per_sqm: number | null;
        source: 'carbon_ledger' | 'live_telemetry' | 'mixed';
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
        source: 'carbon_ledger' | 'audit_log';
        signed_at: string;
    };
}

export const buildComplianceReport = async (
    allowedBuildingIds: string[],
    options: { verifyAuditTrail?: boolean } = {}
): Promise<ComplianceReport> => {
    const generatedAt = new Date();
    const period = previousCalendarMonth(generatedAt);
    const periodStart = period.start;
    const periodEnd = new Date(period.endExclusive.getTime() - 1);
    const buildings = await prisma.building.findMany({
        where: { building_id: { in: allowedBuildingIds } }
    });

    const carbonRowsPromise = prisma.carbonLedgerEntry.findMany({
        where: {
            building_id: { in: allowedBuildingIds },
            period_date: { gte: period.start, lt: period.endExclusive }
        },
        orderBy: [{ building_id: 'asc' }, { period_date: 'asc' }]
    });

    const monthKey = `${period.start.getUTCFullYear()}-${String(period.start.getUTCMonth() + 1).padStart(2, '0')}`;
    const carbonIntegrityPromise = Promise.all(buildings.map((building) =>
        verifyCarbonLedgerMonth(building.building_id, monthKey)
    ));
    const usageEntriesPromise = Promise.all(buildings.map(async (building) => {
        try {
            const usage = await queryUsageBetween(
                building.building_id,
                period.start,
                period.endExclusive,
                COMPLIANCE_TELEMETRY_TIMEOUT_MS
            );
            const kwh = typeof usage === 'number' ? usage : usage?.total_kwh ?? null;
            const cost = typeof usage === 'number' ? null : resolveCostZar(Number(usage?.total_cost_zar ?? 0), Number(usage?.total_cost_usd ?? 0), Number(usage?.total_kwh ?? 0));
            return [building.building_id, { kwh, cost }] as const;
        } 
        catch (error) {
            console.error(`[Compliance] usage lookup failed for ${building.building_id}:`, error);
            return [building.building_id, { kwh: null, cost: null }] as const;
        }
    }));

    const anomaliesPromise = prisma.anomaly.findMany({
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

    const recommendationsPromise = prisma.$queryRaw<{ status: string | null; estimated_monthly_savings: unknown }[]>(Prisma.sql
        `SELECT status::text AS status, estimated_monthly_savings
         FROM public.optimisation_recommendations
         WHERE "building_id"::text IN (${Prisma.join(allowedBuildingIds)}) AND "generated_date" >= ${periodStart}AND "generated_date" <= ${periodEnd}`
    ).catch(() => []);

    const entriesInPeriodPromise = prisma.auditLog.count({
        where: { 
            timestamp: 
            { 
                gte: periodStart, 
                lte: periodEnd 
            } 
    }
    });

    const totalChainedEntriesPromise = prisma.auditLog.count({
        where: 
        { 
            chain_index: { 
                not: null 
            } 
        }
    });

    const [
        carbonRows,
        carbonIntegrity,
        usageEntries,
        anomalies,
        recommendations,
        entriesInPeriod,
        totalChainedEntries,
        integrity
    ] = await Promise.all([
        carbonRowsPromise,
        carbonIntegrityPromise,
        usageEntriesPromise,
        anomaliesPromise,
        recommendationsPromise,
        entriesInPeriodPromise,
        totalChainedEntriesPromise,
        options.verifyAuditTrail ? verifyAuditChain() : getAuditChainSnapshot()
    ]);

    const carbonByBuilding = new Map<string, number>();
    const ledgerUsageByBuilding = new Map<string, number>();
    const ledgerRowsByBuilding = new Map<string, number>();
    for (const row of carbonRows) {
        carbonByBuilding.set(
            row.building_id,
            (carbonByBuilding.get(row.building_id) ?? 0) + Number(row.total_kg_co2e)
        );
        ledgerUsageByBuilding.set(
            row.building_id,
            (ledgerUsageByBuilding.get(row.building_id) ?? 0) + Number(row.total_kwh)
        );
        ledgerRowsByBuilding.set(row.building_id, (ledgerRowsByBuilding.get(row.building_id) ?? 0) + 1);
    }
    const carbonIntegrityByBuilding = new Map(
        carbonIntegrity.map((entry) => [entry.building_id, entry])
    );
    const usageByBuilding = new Map<string, { kwh: number | null; cost: number | null }>(usageEntries);
    const usageMatchesLedger = (liveUsage: number | null, ledgerUsage: number): boolean => {
        if (liveUsage === null) {
            return false;
        }
        const tolerance = Math.max(0.01, Math.abs(ledgerUsage) * 0.001);
        return Math.abs(liveUsage - ledgerUsage) <= tolerance;
    };

    const reportedByBuilding = new Map<string, {
        kwh: number | null;
        cost: number | null;
        source: 'carbon_ledger' | 'live_telemetry';
    }>();
    for (const building of buildings) {
        const live = usageByBuilding.get(building.building_id) ?? { kwh: null, cost: null };
        const integrityResult = carbonIntegrityByBuilding.get(building.building_id);
        const hasVerifiedLedger = (ledgerRowsByBuilding.get(building.building_id) ?? 0) > 0
            && integrityResult?.verified === true;
        if (hasVerifiedLedger) {
            const ledgerUsage = ledgerUsageByBuilding.get(building.building_id) ?? 0;
            reportedByBuilding.set(building.building_id, {
                kwh: ledgerUsage,
                // Never present a retained subset of telemetry as the full-month cost.
                cost: integrityResult.status === 'VALID' && usageMatchesLedger(live.kwh, ledgerUsage)
                    ? live.cost
                    : null,
                source: 'carbon_ledger'
            });
        } else {
            reportedByBuilding.set(building.building_id, {
                kwh: live.kwh,
                cost: live.cost,
                source: 'live_telemetry'
            });
        }
    }

    const totalUsage = buildings.reduce((sum, building) => sum + (reportedByBuilding.get(building.building_id)?.kwh ?? 0), 0);
    const allCostsAvailable = buildings.every((building) => reportedByBuilding.get(building.building_id)?.cost !== null);
    const totalCost = allCostsAvailable
        ? buildings.reduce((sum, building) => sum + (reportedByBuilding.get(building.building_id)?.cost ?? 0), 0)
        : null;
    const totalFloorArea = buildings.reduce((sum, building) => sum + (building.square_footage ? Number(building.square_footage) : 0), 0);
    const totalFloorAreaSqm = totalFloorArea * 0.09290304;

    const shareOf = (value: number | null): number | null => {
        if (value === null || totalUsage <= 0){ 
            return null;
        }
        return Number(((value / totalUsage) * 100).toFixed(2));
    };

    const sites = buildings.map((building) => {
            const usage = reportedByBuilding.get(building.building_id);
            return {
                building_id: building.building_id,
                name: building.building_name,
                type: building.building_type ? String(building.building_type) : null,
                usage_kwh: usage?.kwh ?? null,
                cost_zar: usage?.cost ?? null,
                carbon_kg_co2e: carbonIntegrityByBuilding.get(building.building_id)?.verified
                    ? (carbonByBuilding.get(building.building_id) ?? null)
                    : null,
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
    let carbonScopeStatus: ComplianceReport['carbon_accounting']['scope_status'] = 'VALID';
    if (carbonIntegrity.some((entry) => entry.status === 'TAMPERED')) {
        carbonScopeStatus = 'TAMPERED';
    } else if (carbonIntegrity.some((entry) => entry.status === 'INCOMPLETE')) {
        carbonScopeStatus = 'INCOMPLETE';
    }

    const allCarbonChainsVerified = carbonIntegrity.length === buildings.length
        && carbonIntegrity.every((entry) => entry.verified && Boolean(entry.current_hash));
    const carbonHeads = carbonIntegrity
        .filter((entry): entry is CarbonIntegrityResult & { current_hash: string } => entry.verified && Boolean(entry.current_hash))
        .map((entry) => `${entry.building_id}:${entry.current_hash}`)
        .sort();
    const carbonSignature = allCarbonChainsVerified
        ? createHash('sha256').update(carbonHeads.join('\n')).digest('hex')
        : null;
    const carbonRecordsCovered = carbonIntegrity.reduce((sum, entry) => sum + entry.records_checked, 0);
    const totalCarbon = carbonScopeStatus === 'TAMPERED'
        ? null
        : Array.from(carbonByBuilding.values()).reduce((sum, value) => sum + value, 0);
    const sourceCompleteEntries = carbonIntegrity.reduce((sum, entry) => sum + entry.source_complete_days, 0);
    const sourceIncompleteEntries = carbonIntegrity.reduce((sum, entry) => sum + entry.source_incomplete_dates.length, 0);
    const expectedCarbonEntries = period.days * buildings.length;
    const missingEntries = carbonIntegrity.reduce((sum, entry) => sum + entry.missing_dates.length, 0);
    const energySources = new Set(Array.from(reportedByBuilding.values()).map((entry) => entry.source));
    const energySource: ComplianceReport['energy_performance']['source'] = energySources.size > 1
        ? 'mixed'
        : (energySources.values().next().value ?? 'live_telemetry');

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
            total_cost_zar: totalCost === null ? null : Number(totalCost.toFixed(2)),
            average_daily_kwh: Number((totalUsage / period.days).toFixed(2)),
            intensity_kwh_per_sqm: totalFloorAreaSqm > 0 ? Number((totalUsage / totalFloorAreaSqm).toFixed(4)) : null,
            source: energySource
        },
        carbon_accounting: {
            total_kg_co2e: totalCarbon === null ? null : Number(totalCarbon.toFixed(2)),
            ledger_entries: carbonRows.length,
            expected_entries: expectedCarbonEntries,
            source_complete_entries: sourceCompleteEntries,
            source_incomplete_entries: sourceIncompleteEntries,
            missing_entries: missingEntries,
            scope_status: carbonScopeStatus,
            buildings: carbonIntegrity
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
            value: carbonSignature ?? (integrity.verified ? integrity.current_hash : null),
            records_covered: carbonSignature ? carbonRecordsCovered : integrity.records_checked,
            source: carbonSignature ? 'carbon_ledger' : 'audit_log',
            signed_at: generatedAt.toISOString()
        }
    };
};
