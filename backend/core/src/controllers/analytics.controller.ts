//controller for getting building energy forecast data 

import { Request, Response } from 'express';
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

export const getForecastController = async (req: Request, res: Response) => {
    try{
        if (!req.user?.id) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        //extract building id from url params
        const { building_id } = req.params;
        if (!UUID_PATTERN.test(building_id)) {
            return res.status(400).json({
                status: 'error',
                message: 'Building ID must be a valid UUID.',
            });
        }

        // extract optional forecast params from request body
        void req.body;

        const accessRecord = await prisma.userBuildingAccess.findFirst({
            where: {
                user_id: req.user.id,
                building_id,
            },
        });

        if (!accessRecord) {
            return res.status(403).json({
                status: 'error',
                message: 'Access Denied: You do not have permission to view this forecast.',
            });
        }

        const analytics = await prisma.$queryRaw<any[]>`
            SELECT * FROM public.building_analytics 
            WHERE building_id = ${building_id} 
            LIMIT 1
        `;

        // check if analytics data exists for this building
        if (!analytics || analytics.length === 0) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Forecast models are currently being generated for this building. Please check back later.' 
            });
        }
        
        // extracting first and only record
        const data = analytics[0];

        const synthesisedHistorical = [
            {
                timestamp: data.updated_at || new Date().toISOString(),
                kwh: Number(data.todays_usage) || 0
            }
        ];

        const rawForecastSeries = Array.isArray(data.forecast_series) ? data.forecast_series : [];
        const normalizedForecastSeries = rawForecastSeries
            .map((point: any) => {
                const yhat =
                    toFiniteNumber(point?.yhat) ??
                    toFiniteNumber(point?.predicted_usage) ??
                    toFiniteNumber(point?.value);

                if (!point?.timestamp || yhat === null) {
                    return null;
                }

                const lowerBound =
                    toFiniteNumber(point?.yhat_lower) ??
                    toFiniteNumber(point?.lower) ??
                    yhat;
                const upperBound =
                    toFiniteNumber(point?.yhat_upper) ??
                    toFiniteNumber(point?.upper) ??
                    yhat;

                return {
                    timestamp: point.timestamp,
                    yhat,
                    yhat_lower: Math.min(lowerBound, upperBound),
                    yhat_upper: Math.max(lowerBound, upperBound),
                };
            })
            .filter((point: NormalizedForecastPoint | null): point is NormalizedForecastPoint => point !== null);

        const result = {
            historical: synthesisedHistorical, 
            forecast: normalizedForecastSeries, 
            summary: {
                peak_kwh: Number(data.forecast_peak) || 0,
                peak_timestamp: data.updated_at || new Date().toISOString(),
                avg_daily_kwh: Number(data.forecast_avg_day) || 0,
                mape: Number(data.model_mape) || 0
            }
        };

        return res.status(200).json(result);
    }
    catch (error: any){
        console.error("Analytics Bridge Error:", error);
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve analytics data' });
    }
};
