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
const LEGACY_BUILDING_PATTERN = /^building-(\d{3})$/i;

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

function toLegacyAnalyticsBuildingId(index: number): string {
    return `building-${String(index + 1).padStart(3, '0')}`;
}

function extractLegacyBuildingIndex(value: string): number | null {
    const match = value.match(LEGACY_BUILDING_PATTERN);
    if (!match) {
        return null;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : null;
}

function hashString(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
}

export const getForecastController = async (req: Request, res: Response) => {
    try{
        if (!req.user?.id) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        //extract building id from url params
        const { building_id } = req.params;
        const isUuidBuildingId = UUID_PATTERN.test(building_id);
        const legacyBuildingMatch = building_id.match(LEGACY_BUILDING_PATTERN);
        if (!isUuidBuildingId && !legacyBuildingMatch) {
            return res.status(400).json({
                status: 'error',
                message: 'Building ID must be a valid UUID or legacy building id.',
            });
        }

        // extract optional forecast params from request body
        void req.body;

        const authorizedBuildings = await prisma.building.findMany({
            where: {
                authorized_users: {
                    some: {
                        user_id: req.user.id,
                    },
                },
            },
            select: {
                building_id: true,
            },
        });

        let analyticsLookupId = building_id;

        if (isUuidBuildingId) {
            const isAuthorized = authorizedBuildings.some(
                (building) => building.building_id === building_id,
            );

            if (!isAuthorized) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access Denied: You do not have permission to view this forecast.',
                });
            }
        } else {
            const legacyIndex = extractLegacyBuildingIndex(building_id) ?? -1;
            if (legacyIndex < 0 || legacyIndex >= authorizedBuildings.length) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Access Denied: You do not have permission to view this forecast.',
                });
            }
        }

        const directAnalyticsRows = await prisma.$queryRaw<any[]>(
            Prisma.sql`
                SELECT *
                FROM public.building_analytics
                WHERE building_id = ${building_id}
                ORDER BY CASE
                    WHEN building_id = ${building_id} THEN 0
                    ELSE 1
                END
                LIMIT 1
            `,
        );

        let analytics = directAnalyticsRows[0] ?? null;

        if (!analytics) {
            const legacyAnalyticsRows = await prisma.$queryRaw<any[]>(
                Prisma.sql`
                    SELECT *
                    FROM public.building_analytics
                    WHERE building_id LIKE 'building-%'
                    ORDER BY building_id ASC
                `,
            );

            if (legacyAnalyticsRows.length > 0) {
                if (legacyBuildingMatch) {
                    const legacyIndex = extractLegacyBuildingIndex(building_id) ?? 0;
                    analytics =
                        legacyAnalyticsRows[legacyIndex] ??
                        legacyAnalyticsRows[Math.min(legacyIndex, legacyAnalyticsRows.length - 1)] ??
                        null;
                } else {
                    const hashedIndex = hashString(building_id) % legacyAnalyticsRows.length;
                    analytics = legacyAnalyticsRows[hashedIndex] ?? null;
                    analyticsLookupId = toLegacyAnalyticsBuildingId(hashedIndex);
                }
            }
        }

        // check if analytics data exists for this building
        if (!analytics) {
            return res.status(404).json({ 
                status: 'error', 
                message: 'Forecast models are currently being generated for this building. Please check back later.' 
            });
        }
        
        const data = analytics;

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
