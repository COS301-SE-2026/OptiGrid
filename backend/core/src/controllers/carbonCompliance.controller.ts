import { Request, Response } from 'express';
import { checkBuildingAccess } from '../utils/auth.utils';
import { listCarbonLedgerMonth, verifyCarbonLedgerMonth } from '../services/carbonIntegrity.service';
import { backfillCarbonLedger } from '../workers/carbonLedger.worker';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const readScope = (req: Request): { buildingId: string; month: string } | null => {
    const buildingId = typeof req.query.building_id === 'string' ? req.query.building_id : '';
    const month = typeof req.query.month === 'string' ? req.query.month : '';
    return UUID.test(buildingId) && MONTH.test(month) ? { buildingId, month } : null;
};

const authorizeScope = async (req: Request, res: Response): Promise<{ buildingId: string; month: string } | null> => {
    const scope = readScope(req);
    if (!scope) {
        res.status(400).json({ status: 'error', message: 'building_id and month=YYYY-MM are required.' });
        return null;
    }
    if (!await checkBuildingAccess(req, scope.buildingId)) {
        res.status(403).json({ status: 'error', message: 'You do not have access to this building.' });
        return null;
    }
    return scope;
};

export const getCarbonIntegrity = async (req: Request, res: Response): Promise<void> => {
    try {
        const scope = await authorizeScope(req, res);
        if (!scope) return;
        const result = await verifyCarbonLedgerMonth(scope.buildingId, scope.month);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        console.error('[CarbonComplianceController] Verification failed:', error);
        res.status(500).json({ status: 'error', message: 'Unable to verify the carbon ledger.' });
    }
};

export const getCarbonLedger = async (req: Request, res: Response): Promise<void> => {
    try {
        const scope = await authorizeScope(req, res);
        if (!scope) return;
        const result = await listCarbonLedgerMonth(scope.buildingId, scope.month);
        res.status(200).json({ status: 'success', data: result });
    } catch (error) {
        console.error('[CarbonComplianceController] Ledger lookup failed:', error);
        res.status(500).json({ status: 'error', message: 'Unable to load the carbon ledger.' });
    }
};

export const backfillCarbonLedgerRange = async (req: Request, res: Response): Promise<void> => {
    if (req.user?.roleType !== 'ADMIN') {
        res.status(403).json({ status: 'error', message: 'Administrator access is required.' });
        return;
    }

    const buildingIds = Array.isArray(req.body?.building_ids)
        ? req.body.building_ids.filter((value: unknown): value is string => typeof value === 'string' && UUID.test(value))
        : [];
    const start = new Date(req.body?.start);
    const endExclusive = new Date(req.body?.end_exclusive);
    const days = (endExclusive.getTime() - start.getTime()) / 86_400_000;
    if (buildingIds.length === 0 || !Number.isInteger(days) || days < 1 || days > 366) {
        res.status(400).json({
            status: 'error',
            message: 'Provide valid building_ids and a UTC date range of 1 to 366 days.'
        });
        return;
    }

    try {
        await backfillCarbonLedger(buildingIds, start, endExclusive);
        res.status(202).json({ status: 'success', data: { building_ids: buildingIds, days } });
    } catch (error) {
        console.error('[CarbonComplianceController] Backfill failed:', error);
        res.status(500).json({ status: 'error', message: 'Unable to backfill the carbon ledger.' });
    }
};
