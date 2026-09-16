import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { queryTotalKwh, resolveCostZar } from '../lib/influx';
import { getAllowedBuildingIds } from '../utils/auth.utils';

interface BuildingAnalyticsRow {
    building_id: string;
    forecast_avg_day: number | null;
    forecast_peak: number | null;
    model_mape: number | null;
    todays_usage: number | null;
}

interface UsageSnapshot {
    kwh: number | null;
    costZar: number | null;
}

interface TableColumn {
    header: string;
    width: number;
    align?: 'left' | 'right' | 'center';
}

interface StatTile {
    label: string;
    value: string;
    note?: string;
    accent?: string;
}

interface MetricCell {
    label: string;
    value: string;
}

const palette = {
    ink: '#0B1120',
    text: '#16223A',
    muted: '#5A6B84',
    primary: '#4D869C',
    primaryDeep: '#3A6B7C',
    secondary: '#7AB2B2',
    mist: '#E4EFF8',
    panel: '#F4F8FC',
    border: '#D8E2EC',
    danger: '#B23B3B',
    warning: '#B26B00',
    success: '#2F7D5D',
    white: '#FFFFFF',
    bandText: '#A9BED4'
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const formatDate = (value: Date): string => `${pad(value.getDate())} ${MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;

const formatShortDate = (value: Date): string => `${pad(value.getDate())} ${MONTH_NAMES[value.getMonth()].slice(0, 3)} ${value.getFullYear()}`;

const formatTime = (value: Date): string => `${pad(value.getHours())}:${pad(value.getMinutes())}`;

const formatNumber = (value: number, decimals = 2): string => {
    const fixed = Math.abs(value).toFixed(decimals);
    const [whole, fraction] = fixed.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = value < 0 ? '-' : '';
    return fraction ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`;
};

const formatKwh = (value: number | null | undefined): string => value === null || value === undefined ? 'No data' : formatNumber(Number(value));
const formatKwhWithUnit = (value: number | null | undefined): string => value === null || value === undefined ? 'No data' : `${formatNumber(Number(value))} kWh`;
const formatRand = (value: number | null | undefined): string => value === null || value === undefined ? 'No data' : `R ${formatNumber(Number(value))}`;
const formatPercent = (value: number | null | undefined): string => value === null || value === undefined ? 'No data' : `${formatNumber(Number(value), 1)}%`;

const readable = (value: string | null | undefined, fallback = 'Not set'): string => {
    if (!value){ 
        return fallback;
    }
    const spaced = value.replace(/_/g, ' ').toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined){
        return null;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

export const getSummaryReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const allowedBuildingIds = await getAllowedBuildingIds(req);

        if (allowedBuildingIds.length === 0) {
            res.status(404).json({ status: 'error', message: 'No buildings found for user.' });
            return;
        }

        const buildings = await prisma.building.findMany({
            where: { building_id: { in: allowedBuildingIds } }
        });

        const allAnomalies = await prisma.anomaly.findMany({
            where: { building_id: { in: allowedBuildingIds } }
        });

        const allRecommendations = await prisma.$queryRaw<any[]>(
            Prisma.sql`SELECT * FROM public.optimisation_recommendations WHERE "building_id"::text IN (${Prisma.join(allowedBuildingIds)})`
        ).catch((e) => { console.error(e); return []; });

        const sensorCounts = await prisma.sensor.groupBy({
            by: ['building_id'],
            where: { building_id: { in: allowedBuildingIds } },
            _count: { sensor_id: true }
        }).catch(() => [] as { building_id: string | null; _count: { sensor_id: number } }[]);

        const sensorCountMap = new Map<string, number>();
        for (const entry of sensorCounts) {
            if (entry.building_id){
                sensorCountMap.set(entry.building_id, entry._count.sensor_id);
            }
        }

        const requester = req.user?.id
            ? await prisma.user.findUnique({
                where: { userId: req.user.id },
                select: { firstName: true, lastName: true, email: true }
            }).catch(() => null)
            : null;

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
            if (analytics) analyticsMap.set(bId, analytics);
        }

        const usageToday = new Map<string, UsageSnapshot>();
        const usage30d = new Map<string, UsageSnapshot>();

        const readSnapshot = (payload: any): UsageSnapshot => {
            if (typeof payload === 'number') {
                return { kwh: payload, costZar: null };
            }
            const kwh = toNumber(payload?.total_kwh);
            const costZar = resolveCostZar(
                Number(payload?.total_cost_zar ?? 0),
                Number(payload?.total_cost_usd ?? 0),
                kwh ?? 0
            );
            return { kwh, costZar: kwh === null ? null : costZar };
        };

        await Promise.all(buildings.map(async (b) => {
            try {
                usageToday.set(b.building_id, readSnapshot(await queryTotalKwh(b.building_id, 'today')));
                usage30d.set(b.building_id, readSnapshot(await queryTotalKwh(b.building_id, '30d')));
            } catch (error) {
                console.error(`Failed to get usage for building ${b.building_id}: `, error);
                usageToday.set(b.building_id, { kwh: null, costZar: null });
                usage30d.set(b.building_id, { kwh: null, costZar: null });
            }
        }));

        const severityOf = (value: string | null | undefined): string => (value ?? '').toLowerCase();
        const statusOf = (value: string | null | undefined): string => (value ?? '').toLowerCase();

        const anomalyTotals = {
            critical: allAnomalies.filter((a) => severityOf(a.severity_level) === 'critical').length,
            high: allAnomalies.filter((a) => severityOf(a.severity_level) === 'high').length,
            medium: allAnomalies.filter((a) => severityOf(a.severity_level) === 'medium').length,
            low: allAnomalies.filter((a) => severityOf(a.severity_level) === 'low').length,
            open: allAnomalies.filter((a) => statusOf(a.status) === 'open').length,
            inProgress: allAnomalies.filter((a) => statusOf(a.status) === 'in_progress').length,
            resolved: allAnomalies.filter((a) => statusOf(a.status) === 'resolved').length,
            ignored: allAnomalies.filter((a) => statusOf(a.status) === 'ignored').length
        };

        const anomalyTypeStats = new Map<string, { total: number; critical: number; high: number; latest: Date | null }>();
        for (const anomaly of allAnomalies) {
            const key = anomaly.anomaly_type || 'Unclassified';
            const entry = anomalyTypeStats.get(key) ?? { total: 0, critical: 0, high: 0, latest: null };
            entry.total += 1;
            if (severityOf(anomaly.severity_level) === 'critical'){ 
                entry.critical += 1;
            }
            if (severityOf(anomaly.severity_level) === 'high'){ 
                entry.high += 1;
            }
            const detected = anomaly.detected_timestamp ? new Date(anomaly.detected_timestamp) : null;
            if (detected && (!entry.latest || detected > entry.latest)){ 
                entry.latest = detected;
            }
            anomalyTypeStats.set(key, entry);
        }

        const openByBuilding = new Map<string, number>();
        const criticalByBuilding = new Map<string, number>();

        for (const anomaly of allAnomalies) {
            if (!anomaly.building_id) continue;
            const isClosed = statusOf(anomaly.status) === 'resolved' || statusOf(anomaly.status) === 'ignored';
            if (!isClosed) {
                openByBuilding.set(anomaly.building_id, (openByBuilding.get(anomaly.building_id) ?? 0) + 1);
            }
            if (severityOf(anomaly.severity_level) === 'critical' && !isClosed) {
                criticalByBuilding.set(anomaly.building_id, (criticalByBuilding.get(anomaly.building_id) ?? 0) + 1);
            }
        }

        const recStatusOf = (value: unknown): string => String(value ?? '').toLowerCase();
        const isPendingRec = (value: unknown): boolean => {
            const status = recStatusOf(value);
            return status === 'pending' || status === 'pending_execution';
        };

        const recTotals = {
            total: allRecommendations.length,
            pending: allRecommendations.filter((r) => recStatusOf(r.status) === 'pending').length,
            scheduled: allRecommendations.filter((r) => recStatusOf(r.status) === 'pending_execution').length,
            implemented: allRecommendations.filter((r) => recStatusOf(r.status) === 'implemented').length,
            dismissed: allRecommendations.filter((r) => recStatusOf(r.status) === 'dismissed').length,
            expired: allRecommendations.filter((r) => recStatusOf(r.status) === 'expired').length
        };

        const sumSavings = (rows: any[]): number => rows.reduce((total, row) => total + (Number(row.estimated_monthly_savings) || 0), 0);

        const pendingSavings = sumSavings(allRecommendations.filter((r) => isPendingRec(r.status)));
        const realisedSavings = sumSavings(allRecommendations.filter((r) => recStatusOf(r.status) === 'implemented'));

        const pendingActionsByBuilding = new Map<string, number>();
        const pendingSavingsByBuilding = new Map<string, number>();
        for (const recommendation of allRecommendations) {
            const buildingId = recommendation.building_id ? String(recommendation.building_id) : null;
            if (!buildingId || !isPendingRec(recommendation.status)) continue;
            pendingActionsByBuilding.set(buildingId, (pendingActionsByBuilding.get(buildingId) ?? 0) + 1);
            pendingSavingsByBuilding.set(buildingId, (pendingSavingsByBuilding.get(buildingId) ?? 0) + (Number(recommendation.estimated_monthly_savings) || 0));
        }

        const buildingNames = new Map<string, string>();
        for (const building of buildings){ 
            buildingNames.set(building.building_id, building.building_name);
        }

        const orderedBuildings = [...buildings].sort((a, b) => {
            const usageA = usage30d.get(a.building_id)?.kwh ?? -1;
            const usageB = usage30d.get(b.building_id)?.kwh ?? -1;
            if (usageA !== usageB){
                return usageB - usageA;
            }
            return a.building_name.localeCompare(b.building_name);
        });

        const portfolioToday = orderedBuildings.reduce((total, b) => total + (usageToday.get(b.building_id)?.kwh ?? 0), 0);
        const portfolio30d = orderedBuildings.reduce((total, b) => total + (usage30d.get(b.building_id)?.kwh ?? 0), 0);
        const portfolioCost30d = orderedBuildings.reduce((total, b) => total + (usage30d.get(b.building_id)?.costZar ?? 0), 0);
        const generatedAt = new Date();
        const windowStart = new Date(generatedAt.getTime() - 29 * 24 * 60 * 60 * 1000);

        const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
        const filename = `OptiGrid_Energy_Summary_${generatedAt.getFullYear()}${pad(generatedAt.getMonth() + 1)}${pad(generatedAt.getDate())}.pdf`;

        doc.info.Title = 'OptiGrid Energy Summary Report';
        doc.info.Author = 'OptiGrid';
        doc.info.Subject = 'Energy performance, anomalies and optimisation actions';
        doc.info.Creator = 'OptiGrid';
        doc.info.Producer = 'OptiGrid';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const left = 48;
        const right = doc.page.width - 48;
        const contentWidth = right - left;
        const bottomLimit = doc.page.height - 62;

        doc.on('pageAdded', () => {
            doc.rect(0, 0, doc.page.width, 5).fill(palette.primary);
            doc.fillColor(palette.text);
            doc.x = left;
            doc.y = 58;
        });

        const fitText = (text: string, width: number, spacing?: number): string => {
            const options = spacing ? { characterSpacing: spacing } : undefined;
            if (doc.widthOfString(text, options) <= width){ 
                return text;
            }
            let trimmed = text;
            while (trimmed.length > 1 && doc.widthOfString(`${trimmed}...`, options) > width) {
                trimmed = trimmed.slice(0, -1);
            }
            return `${trimmed.trimEnd()}...`;
        };

        const checkSpacing = (height: number) => {
            if (doc.y + height > bottomLimit){ 
                doc.addPage();
            }
        };

        const drawCoverBand = () => {
            const bandHeight = 108;
            doc.rect(0, 0, doc.page.width, bandHeight).fill(palette.ink);
            doc.rect(0, bandHeight, doc.page.width, 5).fill(palette.primary);
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(palette.secondary).text('OPTIGRID', left, 27, { characterSpacing: 2.4, lineBreak: false });

            doc.font('Helvetica-Bold').fontSize(22).fillColor(palette.white).text('Energy Summary Report', left, 41, { lineBreak: false });
            doc.font('Helvetica').fontSize(9).fillColor(palette.bandText).text('Portfolio performance, anomalies and optimisation actions', left, 72, { lineBreak: false });

            const stampWidth = 150;
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.secondary).text('GENERATED', right - stampWidth, 34, { width: stampWidth, align: 'right', characterSpacing: 1, lineBreak: false });
            doc.font('Helvetica-Bold').fontSize(11).fillColor(palette.white).text(formatDate(generatedAt), right - stampWidth, 47, { width: stampWidth, align: 'right', lineBreak: false });
            doc.font('Helvetica').fontSize(9).fillColor(palette.bandText).text(`${formatTime(generatedAt)} local time`, right - stampWidth, 63, { width: stampWidth, align: 'right', lineBreak: false });

            doc.x = left;
            doc.y = bandHeight + 26;
        };

        const drawMetaStrip = () => {
            const height = 50;
            const y = doc.y;
            doc.lineWidth(0.8);
            doc.roundedRect(left, y, contentWidth, height, 5).fillAndStroke(palette.panel, palette.border);

            const preparedFor = requester
                ? [requester.firstName, requester.lastName].filter(Boolean).join(' ') || requester.email
                : 'OptiGrid user';
            const scope = `${orderedBuildings.length} ${orderedBuildings.length === 1 ? 'building' : 'buildings'}`;
            const window = `${formatShortDate(windowStart)} to ${formatShortDate(generatedAt)}`;

            const cells = [
                { label: 'PREPARED FOR', value: preparedFor },
                { label: 'PORTFOLIO SCOPE', value: scope },
                { label: 'REPORTING WINDOW', value: window }
            ];

            const cellWidth = (contentWidth - 28) / cells.length;
            cells.forEach((cell, index) => {
                const x = left + 14 + index * cellWidth;
                doc.font('Helvetica-Bold').fontSize(7).fillColor(palette.muted).text(cell.label, x, y + 13, { width: cellWidth - 12, characterSpacing: 0.7, lineBreak: false });
                doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.ink).text(fitText(cell.value, cellWidth - 12), x, y + 26, { width: cellWidth - 12, lineBreak: false });
            });

            doc.x = left;
            doc.y = y + height + 22;
        };

        const drawSectionHeader = (title: string, note?: string, startOnNewPage = false) => {
            if (startOnNewPage) {
                doc.addPage();
            } else {
                checkSpacing(56);
            }

            const y = doc.y;
            doc.rect(left, y + 3, 3.5, 14).fill(palette.primary);
            doc.font('Helvetica-Bold').fontSize(13).fillColor(palette.ink).text(title, left + 12, y, { width: contentWidth - 12, lineBreak: false });

            let cursor = y + 18;
            if (note) {
                doc.font('Helvetica').fontSize(8.5).fillColor(palette.muted).text(note, left + 12, cursor, { width: contentWidth - 12 });
                cursor = doc.y + 2;
            }

            doc.moveTo(left, cursor + 6).lineTo(right, cursor + 6).lineWidth(0.8).strokeColor(palette.border).stroke();
            doc.x = left;
            doc.y = cursor + 18;
        };

        const drawSubheading = (text: string, blockHeight: number) => {
            checkSpacing(blockHeight + 18);
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(palette.ink);
            doc.text(text, left, doc.y, { lineBreak: false });
            doc.x = left;
            doc.y += 16;
        };

        const drawStatGrid = (items: StatTile[], perRow: number) => {
            const gap = 10;
            const tileWidth = (contentWidth - gap * (perRow - 1)) / perRow;
            const tileHeight = 58;

            for (let index = 0; index < items.length; index += perRow) {
                const rowItems = items.slice(index, index + perRow);
                checkSpacing(tileHeight + gap);
                const rowY = doc.y;

                rowItems.forEach((item, column) => {
                    const x = left + column * (tileWidth + gap);
                    doc.lineWidth(0.8);
                    doc.roundedRect(x, rowY, tileWidth, tileHeight, 5).fillAndStroke(palette.panel, palette.border);
                    doc.rect(x + 1, rowY + 8, 3, tileHeight - 16).fill(item.accent ?? palette.primary);

                    doc.font('Helvetica-Bold').fontSize(7).fillColor(palette.muted).text(item.label.toUpperCase(), x + 14, rowY + 11, {
                            width: tileWidth - 24, characterSpacing: 0.6, lineBreak: false
                    });

                    doc.font('Helvetica-Bold').fontSize(14).fillColor(palette.ink);
                    doc.text(fitText(item.value, tileWidth - 24), x + 14, rowY + 24, {
                        width: tileWidth - 24, lineBreak: false
                    });

                    if (item.note) {
                        doc.font('Helvetica').fontSize(7.5).fillColor(palette.muted);
                        doc.text(fitText(item.note, tileWidth - 24), x + 14, rowY + 43, {
                            width: tileWidth - 24, lineBreak: false
                        });
                    }
                });

                doc.x = left;
                doc.y = rowY + tileHeight + gap;
            }

            doc.y += 2;
        };

        const drawTable = (columns: TableColumn[], rows: string[][], wrapColumn?: number) => {
            const padX = 7;
            const headerHeight = 21;
            const drawHeaderRow = () => {
                const y = doc.y;
                doc.rect(left, y, contentWidth, headerHeight).fill(palette.ink);
                let x = left;
                for (const column of columns) {
                    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.white);
                    doc.text(fitText(column.header.toUpperCase(), column.width - padX * 2, 0.5), x + padX, y + 7.5, {
                        width: column.width - padX * 2,
                        align: column.align ?? 'left',
                        characterSpacing: 0.5,
                        lineBreak: false
                    });
                    x += column.width;
                }
                doc.x = left;
                doc.y = y + headerHeight;
            };

            checkSpacing(headerHeight + 44);
            drawHeaderRow();

            rows.forEach((row, rowIndex) => {
                doc.font('Helvetica').fontSize(8.5);
                let rowHeight = 20;
                if (wrapColumn !== undefined) {
                    const wrapWidth = columns[wrapColumn].width - padX * 2;
                    rowHeight = Math.max(rowHeight, doc.heightOfString(row[wrapColumn] ?? '', { width: wrapWidth }) + 11);
                }

                if (doc.y + rowHeight > bottomLimit) {
                    doc.addPage();
                    drawHeaderRow();
                }

                const y = doc.y;
                if (rowIndex % 2 === 1) {
                    doc.rect(left, y, contentWidth, rowHeight).fill(palette.panel);
                }
                doc.moveTo(left, y + rowHeight).lineTo(right, y + rowHeight).lineWidth(0.5).strokeColor(palette.border).stroke();

                let x = left;
                columns.forEach((column, columnIndex) => {
                    const isName = columnIndex === 0;
                    doc.font(isName ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(isName ? palette.ink : palette.text);
                    const cellWidth = column.width - padX * 2;
                    const value = row[columnIndex] ?? '';

                    if (columnIndex === wrapColumn) {
                        doc.text(value, x + padX, y + 6, { width: cellWidth, align: column.align ?? 'left' });
                    } else {
                        doc.text(fitText(value, cellWidth), x + padX, y + 6.5, {
                            width: cellWidth, align: column.align ?? 'left', lineBreak: false
                        });
                    }
                    x += column.width;
                });

                doc.x = left;
                doc.y = y + rowHeight;
            });

            doc.y += 14;
        };

        const drawDistribution = (entries: { label: string; count: number; colour: string }[]) => {
            const total = entries.reduce((sum, entry) => sum + entry.count, 0);
            const labelWidth = 92;
            const valueWidth = 88;
            const trackWidth = contentWidth - labelWidth - valueWidth;

            checkSpacing(entries.length * 20 + 8);

            for (const entry of entries) {
                const y = doc.y;

                doc.font('Helvetica').fontSize(9).fillColor(palette.text).text(entry.label, left, y + 1, { width: labelWidth - 8, lineBreak: false });

                doc.roundedRect(left + labelWidth, y + 2.5, trackWidth, 9, 4.5).fill(palette.mist);
                const ratio = total > 0 ? entry.count / total : 0;
                if (ratio > 0) {
                    doc.roundedRect(left + labelWidth, y + 2.5, Math.max(ratio * trackWidth, 5), 9, 4.5).fill(entry.colour);
                }
                const share = total > 0 ? `${Math.round(ratio * 100)}%` : '0%';
                doc.font('Helvetica-Bold').fontSize(9).fillColor(palette.ink)
                    .text(`${entry.count}  (${share})`, right - valueWidth, y + 1, {
                        width: valueWidth, align: 'right', lineBreak: false
                    });

                doc.x = left;
                doc.y = y + 20;
            }

            doc.y += 8;
        };

        const drawEmptyNote = (message: string) => {
            checkSpacing(40);
            const y = doc.y;
            doc.lineWidth(0.8);
            doc.roundedRect(left, y, contentWidth, 32, 5).fillAndStroke(palette.panel, palette.border);
            doc.font('Helvetica').fontSize(9).fillColor(palette.muted)
                .text(message, left + 14, y + 11, { width: contentWidth - 28, lineBreak: false });
            doc.x = left;
            doc.y = y + 46;
        };

        const drawPill = (text: string, rightEdge: number, y: number, background: string, textColour: string): number => {
            doc.font('Helvetica-Bold').fontSize(7);
            const label = text.toUpperCase();
            const width = doc.widthOfString(label, { characterSpacing: 0.5 }) + 16;
            const x = rightEdge - width;
            doc.roundedRect(x, y, width, 14, 7).fill(background);
            doc.fillColor(textColour).text(label, x + 8, y + 4, { characterSpacing: 0.5, lineBreak: false });
            return width;
        };

        const drawBuildingCard = (building: typeof buildings[number]) => {
            const analytics = analyticsMap.get(building.building_id);
            const today = usageToday.get(building.building_id);
            const month = usage30d.get(building.building_id);
            const fallbackToday = toNumber(analytics?.todays_usage);

            const metrics: MetricCell[] = [
                { label: 'Usage today', value: formatKwhWithUnit(today?.kwh ?? fallbackToday) },
                { label: 'Usage 30 days', value: formatKwhWithUnit(month?.kwh) },
                { label: 'Cost 30 days', value: formatRand(month?.costZar) },
                { label: 'Sensors', value: `${sensorCountMap.get(building.building_id) ?? 0}` },
                { label: 'Forecast per day', value: formatKwhWithUnit(toNumber(analytics?.forecast_avg_day)) },
                { label: 'Forecast peak', value: formatKwhWithUnit(toNumber(analytics?.forecast_peak)) },
                { label: 'Model error', value: formatPercent(toNumber(analytics?.model_mape)) },
                { label: 'Floor area', value: building.square_footage ? `${formatNumber(Number(building.square_footage), 0)} sqft` : 'Not set' },
                { label: 'Open anomalies', value: `${openByBuilding.get(building.building_id) ?? 0}` },
                { label: 'Critical open', value: `${criticalByBuilding.get(building.building_id) ?? 0}` },
                { label: 'Pending actions', value: `${pendingActionsByBuilding.get(building.building_id) ?? 0}` },
                { label: 'Pending savings', value: formatRand(pendingSavingsByBuilding.get(building.building_id) ?? 0) }
            ];

            const perRow = 4;
            const metricRows = Math.ceil(metrics.length / perRow);
            const headerHeight = 50;
            const metricRowHeight = 33;
            const cardHeight = headerHeight + metricRows * metricRowHeight + 8;

            checkSpacing(cardHeight + 14);
            const y = doc.y;

            doc.lineWidth(0.8);
            doc.roundedRect(left, y, contentWidth, cardHeight, 6).fillAndStroke(palette.white, palette.border);

            const lifecycle = readable(building.lifecycle_state, 'Unknown');
            const lifecycleColour = building.lifecycle_state === 'ACTIVE' ? palette.success : palette.muted;
            const lifecycleWidth = drawPill(lifecycle, right - 14, y + 14, palette.mist, lifecycleColour);
            drawPill(readable(building.building_type, 'Unspecified'), right - 22 - lifecycleWidth, y + 14, palette.mist, palette.primaryDeep);

            doc.font('Helvetica-Bold').fontSize(12).fillColor(palette.ink);
            doc.text(fitText(building.building_name, contentWidth - 220), left + 14, y + 13, { lineBreak: false });

            const occupancy = building.max_occupancy ? `${formatNumber(building.max_occupancy, 0)} occupants` : 'Occupancy not set';
            doc.font('Helvetica').fontSize(8).fillColor(palette.muted);
            doc.text(fitText(building.physical_address || 'Address not captured', contentWidth - 236), left + 14, y + 31, { lineBreak: false });
            doc.text(fitText(`${building.timezone || 'UTC'}, ${occupancy}`, 194), right - 208, y + 31, {
                width: 194, align: 'right', lineBreak: false
            });

            doc.moveTo(left + 14, y + headerHeight - 8).lineTo(right - 14, y + headerHeight - 8).lineWidth(0.5).strokeColor(palette.border).stroke();

            const cellWidth = (contentWidth - 28) / perRow;
            metrics.forEach((metric, index) => {
                const column = index % perRow;
                const row = Math.floor(index / perRow);
                const cellX = left + 14 + column * cellWidth;
                const cellY = y + headerHeight + row * metricRowHeight - 4;

                doc.font('Helvetica-Bold').fontSize(6.5).fillColor(palette.muted);
                doc.text(metric.label.toUpperCase(), cellX, cellY, {
                    width: cellWidth - 10, characterSpacing: 0.5, lineBreak: false
                });

                doc.font('Helvetica-Bold').fontSize(10).fillColor(palette.text);
                doc.text(fitText(metric.value, cellWidth - 10), cellX, cellY + 11, {
                    width: cellWidth - 10, lineBreak: false
                });
            });

            doc.x = left;
            doc.y = y + cardHeight + 14;
        };

        drawCoverBand();
        drawMetaStrip();
        drawSectionHeader('Portfolio summary', 'Consumption, spend and open work across every building you have access to.');
        drawStatGrid([
            { label: 'Buildings monitored', value: `${orderedBuildings.length}`, note: `${sensorCountMap.size} with sensors installed` },
            { label: 'Usage today', value: `${formatNumber(portfolioToday)} kWh`, note: 'Across the full portfolio' },
            { label: 'Usage last 30 days', value: `${formatNumber(portfolio30d)} kWh`, note: `${formatShortDate(windowStart)} to ${formatShortDate(generatedAt)}` },
            { label: 'Cost last 30 days', value: `R ${formatNumber(portfolioCost30d)}`, note: 'Estimated from metered usage', accent: palette.secondary },
            { label: 'Open anomalies', value: `${anomalyTotals.open + anomalyTotals.inProgress}`, note: `${anomalyTotals.critical} critical detected overall`, accent: anomalyTotals.critical > 0 ? palette.danger : palette.secondary },
            { label: 'Savings available', value: `R ${formatNumber(pendingSavings)}`, note: `${recTotals.pending + recTotals.scheduled} actions awaiting approval`, accent: palette.success }
        ], 3);
        drawSectionHeader('Buildings', 'Ranked by consumption over the last 30 days. Usage and forecast values are in kWh.');
        drawTable(
            [
                { header: 'Building', width: 152 },
                { header: 'Type', width: 64 },
                { header: 'Today', width: 60, align: 'right' },
                { header: '30 days', width: 66, align: 'right' },
                { header: 'Forecast', width: 66, align: 'right' },
                { header: 'Mape', width: 44, align: 'right' },
                { header: 'Open', width: 47, align: 'right' }
            ],
            orderedBuildings.map((building) => {
                const analytics = analyticsMap.get(building.building_id);
                const today = usageToday.get(building.building_id)?.kwh ?? toNumber(analytics?.todays_usage);
                return [
                    building.building_name,
                    readable(building.building_type, 'Unspecified'),
                    formatKwh(today),
                    formatKwh(usage30d.get(building.building_id)?.kwh),
                    formatKwh(toNumber(analytics?.forecast_avg_day)),
                    formatPercent(toNumber(analytics?.model_mape)),
                    `${openByBuilding.get(building.building_id) ?? 0}`
                ];
            })
        );

        drawSectionHeader('Building profiles', 'Metered usage, forecast accuracy and outstanding work per site. Values in kWh unless stated.');
        for (const building of orderedBuildings) {
            drawBuildingCard(building);
        }

        drawSectionHeader('Anomalies', 'Every anomaly raised against your buildings, grouped by state and severity.', true);
        if (allAnomalies.length === 0) {
            drawEmptyNote('No anomalies have been raised for these buildings.');
        } 
        else {
            drawStatGrid([
                { label: 'Total raised', value: `${allAnomalies.length}` },
                { label: 'Open', value: `${anomalyTotals.open}`, accent: anomalyTotals.open > 0 ? palette.danger : palette.secondary },
                { label: 'In progress', value: `${anomalyTotals.inProgress}`, accent: palette.warning },
                { label: 'Closed', value: `${anomalyTotals.resolved + anomalyTotals.ignored}`, note: `${anomalyTotals.resolved} resolved, ${anomalyTotals.ignored} ignored`, accent: palette.success }
            ], 4);

            drawSubheading('Severity split', 88);
            drawDistribution([
                { label: 'Critical', count: anomalyTotals.critical, colour: palette.danger },
                { label: 'High', count: anomalyTotals.high, colour: palette.warning },
                { label: 'Medium', count: anomalyTotals.medium, colour: palette.primary },
                { label: 'Low', count: anomalyTotals.low, colour: palette.secondary }
            ]);

            const topTypes = [...anomalyTypeStats.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 8);

            if (topTypes.length > 0) {
                drawSubheading('Most frequent anomaly types', 82);
                drawTable(
                    [
                        { header: 'Anomaly type', width: 190 },
                        { header: 'Detected', width: 62, align: 'right' },
                        { header: 'Critical', width: 60, align: 'right' },
                        { header: 'High', width: 55, align: 'right' },
                        { header: 'Last detected', width: 132, align: 'right' }
                    ],
                    topTypes.map(([type, stats]) => [
                        readable(type, 'Unclassified'),
                        `${stats.total}`,
                        `${stats.critical}`,
                        `${stats.high}`,
                        stats.latest ? `${formatShortDate(stats.latest)}, ${formatTime(stats.latest)}` : 'Unknown'
                    ])
                );
            }
        }

        drawSectionHeader('Optimisation actions', 'Recommendations generated for your portfolio and the saving attached to each state.');
        if (allRecommendations.length === 0) {
            drawEmptyNote('No optimisation recommendations have been generated yet.');
        } 
        else {
            drawStatGrid([
                { label: 'Total generated', value: `${recTotals.total}` },
                { label: 'Awaiting approval', value: `${recTotals.pending + recTotals.scheduled}`, note: `${recTotals.scheduled} queued for execution`, accent: palette.warning },
                { label: 'Implemented', value: `${recTotals.implemented}`, accent: palette.success },
                { label: 'Savings available', value: `R ${formatNumber(pendingSavings)}`, note: 'Per month if approved', accent: palette.primary },
                { label: 'Savings secured', value: `R ${formatNumber(realisedSavings)}`, note: 'Per month from implemented actions', accent: palette.success },
                { label: 'Closed off', value: `${recTotals.dismissed + recTotals.expired}`, note: `${recTotals.dismissed} dismissed, ${recTotals.expired} expired`, accent: palette.muted }
            ], 3);

            const topRecommendations = [...allRecommendations]
                .sort((a, b) => (Number(b.estimated_monthly_savings) || 0) - (Number(a.estimated_monthly_savings) || 0))
                .slice(0, 10);

            drawSubheading('Highest value recommendations', 92);
            drawTable(
                [
                    { header: 'Building', width: 124 },
                    { header: 'Strategy', width: 188 },
                    { header: 'Status', width: 87 },
                    { header: 'Monthly saving', width: 100, align: 'right' }
                ],
                topRecommendations.map((recommendation) => [
                    buildingNames.get(String(recommendation.building_id)) ?? 'Unassigned',
                    String(recommendation.strategy_description ?? 'No description recorded'),
                    readable(String(recommendation.status ?? ''), 'Unknown'),
                    formatRand(Number(recommendation.estimated_monthly_savings) || 0)
                ]),
                1
            );
        }

        const closingLines = [
            'Open anomalies are triaged and closed from the Anomalies view.',
            'Recommendations are approved or dismissed from the Insights view.',
            'Live consumption, forecasts and sensor health sit in the Realtime view.'
        ];

        checkSpacing(112);
        const closingY = doc.y;
        const closingHeight = 34 + closingLines.length * 18;
        doc.lineWidth(0.8);
        doc.roundedRect(left, closingY, contentWidth, closingHeight, 6).fillAndStroke(palette.panel, palette.border);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(palette.ink)
            .text('Working through this report', left + 16, closingY + 14, { lineBreak: false });

        closingLines.forEach((line, index) => {
            const lineY = closingY + 36 + index * 18;
            doc.rect(left + 16, lineY + 3.5, 4, 4).fill(palette.primary);
            doc.font('Helvetica').fontSize(8.5).fillColor(palette.text).text(line, left + 28, lineY, { width: contentWidth - 44, lineBreak: false });
        });

        const range = doc.bufferedPageRange();
        for (let index = 0; index < range.count; index += 1) {
            doc.switchToPage(range.start + index);
            doc.page.margins.bottom = 0;

            const footerY = doc.page.height - 42;
            doc.moveTo(left, footerY - 10).lineTo(right, footerY - 10).lineWidth(0.5).strokeColor(palette.border).stroke();
            doc.font('Helvetica').fontSize(7.5).fillColor(palette.muted).text('OptiGrid energy summary report', left, footerY, { width: contentWidth / 2, lineBreak: false });
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.muted).text(`Page ${index + 1} of ${range.count}`, left + contentWidth / 2, footerY, {
                    width: contentWidth / 2, align: 'right', lineBreak: false
            });
        }

        doc.end();

    } catch (error) {
        console.error('[ReportController] Error generating summary report:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Failed to generate report' });
        }
    }
};