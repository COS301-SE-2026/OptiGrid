import request from 'supertest';
import { createApp } from '../../../../backend/core/src/app';
import prisma from '../../../../backend/core/src/lib/prisma';


const app = createApp();

describe('Analytics API Integration', () => {
    const testBuildingId = 'integration-test-building-001';

    beforeAll(async () => {
        await prisma.$executeRawUnsafe(
            `DELETE FROM public.building_analytics WHERE building_id = $1`, 
            testBuildingId
        );
    });

    afterAll(async () => {
        await prisma.$executeRawUnsafe(
            `DELETE FROM public.building_analytics WHERE building_id = $1`, 
            testBuildingId
        );
        await prisma.$disconnect();
    });

    it('should return 404 if no analytics data exists for the building', async () => {
        const response = await request(app)
            .post(`/api/analytics/forecast/${testBuildingId}`)
            .send({ horizon_days: 7, granularity: 'hourly' });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'error',
            message: 'Forecast models are currently being generated for this building. Please check back later.'
        });
    });

    it('should return 200 and formatted analytics data when record exists', async () => {
        await prisma.$executeRawUnsafe(`
            INSERT INTO public.building_analytics (
                building_id,
                todays_usage,
                forecast_peak,
                forecast_avg_day,
                model_mape,
                forecast_series,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6::jsonb, NOW()
            )
        `,
            testBuildingId,
            150.5, // todays_usage
            350.5, // forecast_peak
            120.2, // forecast_avg_day
            2.1,   // model_mape
            JSON.stringify([{ timestamp: "2026-05-21T12:00:00Z", yhat: 300 }]) // forecast_series
        );

        const response = await request(app)
            .post(`/api/analytics/forecast/${testBuildingId}`)
            .send({ horizon_days: 7, granularity: 'hourly' });

        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty('historical');
        expect(response.body).toHaveProperty('forecast');
        expect(response.body).toHaveProperty('summary');

        expect(response.body.summary.peak_kwh).toBe(350.5);
        expect(response.body.summary.avg_daily_kwh).toBe(120.2);
        expect(response.body.summary.mape).toBe(2.1);

        if (response.body.historical && response.body.historical.length > 0) {
            expect(response.body.historical[0].kwh).toBe(150.5);
        } else {
            expect(response.body.historical).toEqual([]);
        }

        expect(response.body.forecast[0].yhat).toBe(300);
        expect(response.body.forecast[0].timestamp).toBe("2026-05-21T12:00:00Z");
    });

    it('should gracefully handle unexpected payload parameters and execute cleanly', async () => {
        const response = await request(app)
            .post(`/api/analytics/forecast/${testBuildingId}`)
            .send({ 
                horizon_days: -5, 
                granularity: 'invalid_granularity' 
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('summary');
        expect(response.body).toHaveProperty('forecast');
    });

    it('should safely handle empty array structures inside JSONB database fields', async () => {
        // clean old record
        await prisma.$executeRawUnsafe(`DELETE FROM public.building_analytics WHERE building_id = $1`, testBuildingId);

        await prisma.$executeRawUnsafe(`
            INSERT INTO public.building_analytics (
                building_id, todays_usage, forecast_peak, forecast_avg_day, model_mape, forecast_series, updated_at
            ) VALUES ($1, $2, $3, $4, $5, '[]'::jsonb, NOW())
        `, testBuildingId, 100, 200, 150, 5.0);

        const response = await request(app)
            .post(`/api/analytics/forecast/${testBuildingId}`)
            .send({ horizon_days: 7, granularity: 'hourly' });

        expect(response.status).toBe(200);
        expect(response.body.forecast).toEqual([]);
    });
});