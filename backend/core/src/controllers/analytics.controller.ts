//controller for getting building energy forecast data 

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

type NormalizedForecastPoint = {
    timestamp: string;
    yhat: number;
    yhat_lower: number;
    yhat_upper: number;
};

interface BuildingAnalyticsRow {
    building_id: string;
    updated_at: string | null;
    todays_usage: number | null;
    forecast_series: unknown;
    forecast_peak: number | null;
    forecast_avg_day: number | null;
    model_mape: number | null;
    [key: string]: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_BUILDING_PATTERN = /^(bld_|building_)[a-z0-9_-]+$/i;
const isValidBuildingId = (id: string) => UUID_PATTERN.test(id) || LEGACY_BUILDING_PATTERN.test(id);

function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}

const authorizeBuildingAccess = async (userId: string | undefined, buildingId: string, res: Response): Promise<boolean> => {
    if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return false;
    }
    if (!isValidBuildingId(buildingId)) {
        res.status(400).json({ status: 'error', message: 'Building ID must be a valid UUID or legacy building id.' });
        return false;
    }
    const authorizedBuildings = await prisma.building.findMany({
        where: { authorized_users: { some: { user_id: userId } } },
        select: { building_id: true }
    });
    if (!authorizedBuildings.some(b => b.building_id === buildingId)) {
        res.status(403).json({ status: 'error', message: 'Access Denied: You do not have permission to view this forecast.' });
        return false;
    }
    return true;
};

export const refreshAnalyticsController = async (req: Request, res: Response) => {
    try {
        const { building_id } = req.params;
        const isAuth = await authorizeBuildingAccess(req.user?.id, building_id, res);
        if (!isAuth) return;

        const pythonEngineUrl = process.env.ANALYTICS_URL || 'http://localhost:5001';
        const refreshResponse = await fetch(`${pythonEngineUrl}/refresh-building/${building_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!refreshResponse.ok) {
            throw new Error(`Analytics engine returned status ${refreshResponse.status}`);
        }

        const refreshData = await refreshResponse.json();
        return res.status(200).json(refreshData);
    } catch (error) {
        console.error("Analytics failed:", error);
        return res.status(500).json({ status: 'error', message: 'Failed to refresh analytics' });
    }
};

export const getForecastController = async (req: Request, res: Response) => {
    try {
        //verify user is auth
        const { building_id } = req.params;
        const horizon = (req.query?.horizon === 'monthly' || req.body?.horizon === 'monthly') ? 'monthly' : 'weekly';

        const isAuth = await authorizeBuildingAccess(req.user?.id, building_id, res);
        if (!isAuth) return;

        // fetch analytics data from appropriate table based on horizon
        const directAnalyticsRows = horizon === 'monthly'
            ? await prisma.$queryRaw<BuildingAnalyticsRow[]>(Prisma.sql`SELECT * FROM public.building_analytics_monthly WHERE building_id::text = ${building_id} LIMIT 1`)
            : await prisma.$queryRaw<BuildingAnalyticsRow[]>(Prisma.sql`SELECT * FROM public.building_analytics_weekly WHERE building_id::text = ${building_id} LIMIT 1`);

        let analytics = directAnalyticsRows[0] ?? null;

        if (!analytics) {
            const fallbackRows = await prisma.$queryRaw<BuildingAnalyticsRow[]>(Prisma.sql`SELECT * FROM public.building_analytics WHERE building_id::text = ${building_id} LIMIT 1`).catch(() => []);
            analytics = fallbackRows[0] ?? null;
        }

        // return 404 if no data found (models yet to be generated)
        if (!analytics) {
            return res.status(404).json({ status: 'error', message: 'Forecast models are currently being generated for this building. Please check back later.' });
        }
        
        // parse and normalise forecast series data from JSON
        const rawForecastSeries = Array.isArray(analytics.forecast_series) ? analytics.forecast_series : [];
        const normalizedForecastSeries = rawForecastSeries.map((point: Record<string, unknown>) => {
            const yhat = toFiniteNumber(point?.yhat) ?? toFiniteNumber(point?.predicted_usage) ?? toFiniteNumber(point?.value);
            // extract predicted value from various possible field names
            if (!point?.timestamp || yhat === null) return null;

            // extract confidence interval bounds
            const lowerBound = toFiniteNumber(point?.yhat_lower) ?? toFiniteNumber(point?.lower) ?? yhat;
            const upperBound = toFiniteNumber(point?.yhat_upper) ?? toFiniteNumber(point?.upper) ?? yhat;

            return {
                timestamp: point.timestamp as string,
                yhat,
                yhat_lower: Math.min(lowerBound, upperBound),
                yhat_upper: Math.max(lowerBound, upperBound),
            };
        }).filter((point: NormalizedForecastPoint | null): point is NormalizedForecastPoint => point !== null);

        const nowMs = Date.now();
        const futureForecasts = normalizedForecastSeries.filter(p => new Date(p.timestamp).getTime() >= nowMs);
        const seriesToUse = futureForecasts.length > 0 ? futureForecasts : normalizedForecastSeries;

        const historicalKwh = seriesToUse.length > 0
            ? seriesToUse[0].yhat
            : Number(analytics.todays_usage) || 0;

        const synthesisedHistorical = [{
            timestamp: analytics.updated_at || new Date().toISOString(),
            kwh: historicalKwh
        }];

        let peak_kwh = Number(analytics.forecast_peak) || 0;
        let peak_timestamp = analytics.updated_at || new Date().toISOString();

        if (seriesToUse.length > 0) {
            const peakPoint = seriesToUse.reduce((prev, current) => 
                (prev.yhat > current.yhat) ? prev : current
            );
            peak_kwh = peakPoint.yhat;
            peak_timestamp = peakPoint.timestamp;
        }

        //building final response with historical data, forecast and summary metric
        const result = {
            historical: synthesisedHistorical, 
            forecast: seriesToUse, 
            summary: {
                peak_kwh,
                peak_timestamp,
                avg_daily_kwh: Number(analytics.forecast_avg_day) || 0,
                mape: Number(analytics.model_mape) || 0
            }
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error("Analytics failed:", error);
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve analytics data' });
    }
};
