import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { queryTotalKwh } from '../lib/influx';
import prisma from '../lib/prisma';
import { getAllowedBuildingIds } from '../utils/auth.utils';

interface BuildingAnalyticsRow {
    building_id: string;
    forecast_avg_day: number | null;
    model_mape: number | null;
    todays_usage: number | null;
}

export const getSummaryReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const allowedBuildingIds = await getAllowedBuildingIds(req);

        if (allowedBuildingIds.length === 0) {
            res.status(404).json({ status: 'error', message: 'No buildings found for user.' });
            return;
        }

        // user buildings
        const buildings = await prisma.building.findMany({
            where: { building_id: { in: allowedBuildingIds } }
        });

        // all anomalies for stats
        const allAnomalies = await prisma.anomaly.findMany({
            where: {
                building_id: { in: allowedBuildingIds }
            }
        });

        // all recommendations for stats
        const allRecommendations = await prisma.$queryRaw<any[]>(
            Prisma.sql`SELECT * FROM public.optimisation_recommendations WHERE "building_id"::text IN (${Prisma.join(allowedBuildingIds)})`
        ).catch((e) => { console.error(e); return []; });

        // forecasts from analytics
        const analyticsMap = new Map<string, BuildingAnalyticsRow>();
        for (const bId of allowedBuildingIds) {
            const direct = await prisma.$queryRaw<BuildingAnalyticsRow[]>(
                Prisma.sql`SELECT * FROM public.building_analytics_weekly WHERE building_id::text = ${bId} LIMIT 1`
            ).catch(() => []);
            let analytics = direct[0] ?? null;
            if (!analytics) {
                const fallback = await prisma.$queryRaw<BuildingAnalyticsRow[]>(
                    Prisma.sql`SELECT * FROM public.building_analytics WHERE building_id::text = ${bId} LIMIT 1`
                ).catch(() => []);
                analytics = fallback[0] ?? null;
            }
            if (analytics) {
                analyticsMap.set(bId, analytics);
            }
        }

        // fetch today's and 30d usage from influx for all buildings
        const influxUsageMap = new Map<string, number | null>();
        const influx30dMap = new Map<string, number | null>();
        await Promise.all(buildings.map(async (b) => {
            try {
                const dataToday = await queryTotalKwh(b.building_id, "today");
                influxUsageMap.set(b.building_id, typeof dataToday === "number" ? dataToday : dataToday?.total_kwh ?? null);

                const data30d = await queryTotalKwh(b.building_id, "30d");
                influx30dMap.set(b.building_id, typeof data30d === "number" ? data30d : data30d?.total_kwh ?? null);
            } catch (error) {
                console.error(`Failed to get usage for building ${b.building_id}: `, error);
                influxUsageMap.set(b.building_id, null);
                influx30dMap.set(b.building_id, null);
            }
        }));

        // create pdf
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const filename = 'OptiGrid_Summary_Report.pdf';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // colours from brandstyle guide
        const colours = {
            primary: '#4D869C',
            secondary: '#7AB2B2',
            ink: '#0B1120',
            muted: '#2C3F5F',
            bg: '#EEF7FF',
            border: '#D1D5DB',
            danger: '#B23B3B',
            warning: '#B26B00'
        };

        // logo
        const possiblePaths = [
            path.resolve(__dirname, '../../../assets/logo.png'),    // when running compiled JS from dist/src/controllers
            path.resolve(__dirname, '../../assets/logo.png'),       // when running ts-node from src/controllers
            path.resolve(process.cwd(), 'backend/core/assets/logo.png'), // fallback if cwd is root
            path.resolve(process.cwd(), 'assets/logo.png')          // fallback if cwd is backend/core
        ];

        let logoAdded = false;
        for (const logoPath of possiblePaths) {
            if (fs.existsSync(logoPath)) {
                // center the logo
                doc.image(logoPath, (doc.page.width - 60) / 2, 45, { width: 60 });
                doc.moveDown(4);
                logoAdded = true;
                break;
            }
        }

        if (!logoAdded) {
            doc.moveDown(3);
        }

        // header title
        doc.fontSize(26)
            .fillColor(colours.primary)
            .text('OptiGrid Energy Report', { align: 'center' });

        doc.moveDown(0.5);

        const date = new Date().toLocaleDateString();
        doc.fontSize(12)
            .fillColor(colours.muted)
            .text(`Generated on: ${date}`, { align: 'center' });

        doc.moveDown(2);

        // helper for section headers
        const drawSectionHeader = (title: string) => {
            doc.moveDown();
            doc.fontSize(18)
                .fillColor(colours.primary)
                .text(title);

            // draw underline
            const y = doc.y;
            doc.moveTo(50, y + 2)
                .lineTo(doc.page.width - 50, y + 2)
                .strokeColor(colours.border)
                .lineWidth(1)
                .stroke();
            doc.moveDown(1.5);
        };

        // building overview section
        drawSectionHeader('Buildings Overview');

        buildings.forEach((b) => {
            if (doc.y + 100 > doc.page.height - 50) {
                doc.addPage();
            }
            const analytics = analyticsMap.get(b.building_id);
            const influxUsage = influxUsageMap.get(b.building_id);
            const influx30d = influx30dMap.get(b.building_id);
            const todaysUsage = influxUsage !== null && influxUsage !== undefined ? influxUsage : (analytics?.todays_usage ?? null);
            const usageText = todaysUsage !== null ? `${Number(todaysUsage).toFixed(2)} kWh` : '--';
            const usage30dText = influx30d !== null && influx30d !== undefined ? `${Number(influx30d).toFixed(2)} kWh` : '--';
            const typeStr = b.building_type || 'Unknown Type';

            // subtle background card
            const cardY = doc.y;
            doc.roundedRect(50, cardY, doc.page.width - 100, 110, 6)
                .fill(colours.bg)
                .stroke(colours.border);

            doc.fillColor(colours.ink);

            // title
            doc.fontSize(14)
                .font('Helvetica-Bold')
                .text(`${b.building_name}`, 65, cardY + 12);

            // subtitle
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor(colours.muted)
                .text(`Type: ${typeStr}  |  Address: ${b.physical_address || 'Not specified'}`, 65, cardY + 30);

            // additional info
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor(colours.muted)
                .text(`Timezone: ${b.timezone || 'UTC'}  |  Size: ${b.square_footage || 'N/A'} sqft  |  Max Occupants: ${b.max_occupancy || 'N/A'}`, 65, cardY + 45);

            // usage
            doc.fontSize(11)
                .fillColor(colours.ink)
                .text(`Actual Usage (Today): `, 65, cardY + 65, { continued: true })
                .font('Helvetica-Bold')
                .text(usageText, { continued: true })
                .font('Helvetica')
                .text(`    Actual Usage (Last 30d): `, { continued: true })
                .font('Helvetica-Bold')
                .text(usage30dText);

            if (analytics && analytics.forecast_avg_day !== null && analytics.forecast_avg_day !== undefined) {
                doc.font('Helvetica')
                    .text(`Forecasted Avg (Today): `, 65, cardY + 85, { continued: true })
                    .font('Helvetica-Bold')
                    .text(`${Number(analytics.forecast_avg_day).toFixed(2)} kWh`, { continued: true });

                if (analytics.model_mape !== null && analytics.model_mape !== undefined) {
                    doc.font('Helvetica')
                        .text(`    Model Error (MAPE): `, { continued: true })
                        .font('Helvetica-Bold')
                        .text(`${Number(analytics.model_mape).toFixed(1)}%`);
                } else {
                    doc.text('');
                }
            } else {
                doc.font('Helvetica')
                    .text(`Forecast: `, 65, cardY + 85, { continued: true })
                    .font('Helvetica-Bold')
                    .text(`N/A`);
            }

            // move cursor past the card
            doc.y = cardY + 125;
            doc.x = 50;
        });

        // add page break
        if (doc.y > 600) doc.addPage();

        // active anomalies Section
        drawSectionHeader('Anomalies Summary');

        const totalAnomalies = allAnomalies.length;
        const criticalAnomalies = allAnomalies.filter(a => a.severity_level === 'Critical').length;
        const highAnomalies = allAnomalies.filter(a => a.severity_level === 'High').length;
        const otherAnomalies = totalAnomalies - criticalAnomalies - highAnomalies;

        const anomalyCardY = doc.y;
        doc.roundedRect(50, anomalyCardY, doc.page.width - 100, 100, 6)
            .fill(colours.bg)
            .stroke(colours.border);

        doc.fontSize(16)
            .font('Helvetica-Bold')
            .fillColor(colours.primary)
            .text(`Total Anomalies Detected: ${totalAnomalies}`, 65, anomalyCardY + 15);

        doc.fontSize(12)
            .font('Helvetica')
            .fillColor(colours.ink)
            .text(`Critical Severity: `, 65, anomalyCardY + 45, { continued: true })
            .font('Helvetica-Bold').fillColor(colours.danger).text(`${criticalAnomalies}`, { continued: true })
            .font('Helvetica').fillColor(colours.ink).text(`    |    High Severity: `, { continued: true })
            .font('Helvetica-Bold').fillColor(colours.warning).text(`${highAnomalies}`, { continued: true })
            .font('Helvetica').fillColor(colours.ink).text(`    |    Low/Medium Severity: `, { continued: true })
            .font('Helvetica-Bold').text(`${otherAnomalies}`);

        doc.y = anomalyCardY + 120;
        doc.x = 50;

        if (doc.y > 550) doc.addPage();

        // recommendations section
        drawSectionHeader('Recommendations Summary');

        const totalRecs = allRecommendations.length;
        const totalSaved = allRecommendations.reduce((sum, r) => sum + (Number(r.estimated_monthly_savings) || 0), 0);
        const totalApplied = allRecommendations.filter(r => r.status === 'Implemented').length;
        const totalDismissed = allRecommendations.filter(r => r.status === 'Dismissed' || r.status === 'Rejected').length;
        const totalPending = totalRecs - totalApplied - totalDismissed;

        const recsCardY = doc.y;
        doc.roundedRect(50, recsCardY, doc.page.width - 100, 100, 6)
            .fill(colours.bg)
            .stroke(colours.secondary);

        doc.fontSize(16)
            .font('Helvetica-Bold')
            .fillColor(colours.primary)
            .text(`Total Recommendations: ${totalRecs}`, 65, recsCardY + 15);

        doc.fontSize(12)
            .font('Helvetica')
            .fillColor(colours.ink)
            .text(`Applied: `, 65, recsCardY + 45, { continued: true })
            .font('Helvetica-Bold').text(`${totalApplied}`, { continued: true })
            .font('Helvetica').text(`    |    Pending: `, { continued: true })
            .font('Helvetica-Bold').text(`${totalPending}`, { continued: true })
            .font('Helvetica').text(`    |    Dismissed: `, { continued: true })
            .font('Helvetica-Bold').text(`${totalDismissed}`);

        doc.fontSize(12)
            .font('Helvetica')
            .fillColor(colours.ink)
            .text(`Potential Monthly Savings (Pending): `, 65, recsCardY + 70, { continued: true })
            .font('Helvetica-Bold').fillColor(colours.primary).text(`R ${totalSaved.toFixed(2)}`);

        doc.y = recsCardY + 120;
        doc.x = 50;

        // footer
        doc.moveDown(2);
        doc.fontSize(10)
           .font('Helvetica-Oblique')
           .fillColor(colours.muted)
           .text(`For a detailed breakdown of anomalies and recommendations, please visit the OptiGrid web application.`, { align: 'center' });

        doc.end();

    } catch (error) {
        console.error('[ReportController] Error generating summary report:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Failed to generate report' });
        }
    }
};
