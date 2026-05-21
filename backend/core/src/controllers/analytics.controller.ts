//controller for getting building energy forecast data 

import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getForecastController = async (req: Request, res: Response) => {
    try{
        //extract building id from url params
        const { building_id } = req.params;
        // extract optional forecast params from request body
        const { horizon_days, granularity } = req.body;

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

        const result = {
            historical: [], 
            forecast: data.forecast_series || [], 
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
