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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export const refreshAnalyticsController = async (req: Request, res: Response) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const { building_id } = req.params;
        if (!UUID_PATTERN.test(building_id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid building ID. Must be a valid UUID.' });
        }

        const authorizedBuildings = await prisma.building.findMany({
            where: { authorized_users: { some: { user_id: req.user.id } } },
            select: { building_id: true }
        });

        const isAuthorized = authorizedBuildings.some(b => b.building_id === building_id);
        if (!isAuthorized) {
            return res.status(403).json({ status: 'error', message: 'Access Denied' });
        }

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
    } catch (error: any) {
        return res.status(500).json({ status: 'error', message: 'Failed to refresh analytics' });
    }
};

export const getForecastController = async (req: Request, res: Response) => {
    try {
        //verify user is auth
        if (!req.user?.id) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        // get building id from url params, determine forcast horizon
        const { building_id } = req.params;
        const horizon = req.query.horizon === 'monthly' ? 'monthly' : 'weekly';

        if (!UUID_PATTERN.test(building_id)) {
            return res.status(400).json({ status: 'error', message: 'Invalid building ID. Must be a valid UUID.' });
        }

        // check if user has access to this building
        const authorizedBuildings = await prisma.building.findMany({
            where: { authorized_users: { some: { user_id: req.user.id } } },
            select: { building_id: true }
        });

        const isAuthorized = authorizedBuildings.some(b => b.building_id === building_id);
        if (!isAuthorized) {
            return res.status(403).json({ status: 'error', message: 'Access Denied' });
        }

        // fetch analytics data from appropriate table based on horizon
        const directAnalyticsRows = horizon === 'monthly'
            ? await prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM public.building_analytics_monthly WHERE building_id::text = ${building_id} LIMIT 1`)
            : await prisma.$queryRaw<any[]>(Prisma.sql`SELECT * FROM public.building_analytics_weekly WHERE building_id::text = ${building_id} LIMIT 1`);

        const analytics = directAnalyticsRows[0] ?? null;

        // return 404 if no data found (models yet to be generated)
        if (!analytics) {
            return res.status(404).json({ status: 'error', message: 'Forecast models are currently being generated.' });
        }
        
        //build hisotrical data point from last usage
        const synthesisedHistorical = [{
            timestamp: analytics.updated_at || new Date().toISOString(),
            kwh: Number(analytics.todays_usage) || 0
        }];

        // parse and normalise forecase series data from JSON
        const rawForecastSeries = Array.isArray(analytics.forecast_series) ? analytics.forecast_series : [];
        const normalizedForecastSeries = rawForecastSeries.map((point: any) => {
            const yhat = toFiniteNumber(point?.yhat) ?? toFiniteNumber(point?.predicted_usage) ?? toFiniteNumber(point?.value);
            // extract predicted value from various possible field names
            if (!point?.timestamp || yhat === null) return null;

            // extract condidence interval bounds
            const lowerBound = toFiniteNumber(point?.yhat_lower) ?? toFiniteNumber(point?.lower) ?? yhat;
            const upperBound = toFiniteNumber(point?.yhat_upper) ?? toFiniteNumber(point?.upper) ?? yhat;

            return {
                timestamp: point.timestamp,
                yhat,
                yhat_lower: Math.min(lowerBound, upperBound),
                yhat_upper: Math.max(lowerBound, upperBound),
            };
        }).filter((point: NormalizedForecastPoint | null): point is NormalizedForecastPoint => point !== null);

        //buidling final response with historical data, forecast and summary metric
        const result = {
            historical: synthesisedHistorical, 
            forecast: normalizedForecastSeries, 
            summary: {
                peak_kwh: Number(analytics.forecast_peak) || 0,
                peak_timestamp: analytics.updated_at || new Date().toISOString(),
                avg_daily_kwh: Number(analytics.forecast_avg_day) || 0,
                mape: Number(analytics.model_mape) || 0
            }
        };

        return res.status(200).json(result);
    } catch (error: any) {
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve analytics data' });
    }
};
