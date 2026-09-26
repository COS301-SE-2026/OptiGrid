import PDFDocument from 'pdfkit';
import { Request, Response } from 'express';
import { buildComplianceReport, verifyAuditChain, type ComplianceReport } from '../services/compliance.service';
import { getAllowedBuildingIds } from '../utils/auth.utils';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const formatDate = (value: Date): string => `${pad(value.getDate())} ${MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;

const formatShortDate = (value: Date): string => `${pad(value.getDate())} ${MONTH_NAMES[value.getMonth()].slice(0, 3)} ${value.getFullYear()}`;

const palette = {
    ink: '#0B1120',
    text: '#16223A',
    muted: '#5A6B84',
    primary: '#4D869C',
    secondary: '#7AB2B2',
    panel: '#F4F8FC',
    border: '#D8E2EC',
    danger: '#B23B3B',
    success: '#2F7D5D',
    white: '#FFFFFF',
    bandText: '#A9BED4'
};

const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);

const formatNumber = (value: number, decimals = 2): string => {
    const fixed = Math.abs(value).toFixed(decimals);
    const [whole, fraction] = fixed.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const sign = value < 0 ? '-' : '';
    if (fraction){
        return `${sign}${grouped}.${fraction}`;
    }   
    else{
        return `${sign}${grouped}`;
    }
}

const readable = (value: string | null, fallback = 'Not set'): string => {
    if (!value){ 
        return fallback;
    }
    const withSpace = value.replace(/_/g, ' ').toLowerCase();
    return withSpace.charAt(0).toUpperCase() + withSpace.slice(1);
};

export const verifyDataIntegrity = async (req: Request, res: Response): Promise<void> => {
    try {
        const verification = await verifyAuditChain();
        res.status(200).json({ 
            status: 'success', 
            data: verification 
        });
    } 
    catch (error) {
        console.error('[ComplianceController] Chain verification failed:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Unable to verify the audit chain.' 
        });
    }
};

const renderReportPdf = (report: ComplianceReport, res: Response): void => {
    const generatedAt = new Date(report.generated_at);
    const periodStart = new Date(report.period.start);
    const doc = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
    const filename = `OptiGrid_ISO50001_Compliance_${periodStart.getUTCFullYear()}-${pad(periodStart.getUTCMonth() + 1)}.pdf`;

    doc.info.Title = 'OptiGrid ISO 50001 Compliance Report';
    doc.info.Author = 'OptiGrid';
    doc.info.Subject = 'Energy management compliance summary with signed audit trail';
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
        let trimmedText = text;
        while (trimmedText.length > 1 && doc.widthOfString(`${trimmedText}...`, options) > width) {
            trimmedText = trimmedText.slice(0, -1);
        }
        return `${trimmedText.trimEnd()}...`;
    };

    const checkSpacing = (height: number) => {
        if (doc.y + height > bottomLimit){
            doc.addPage();
        }
    };

    const bandHeight = 104;
    doc.rect(0, 0, doc.page.width, bandHeight).fill(palette.ink);
    doc.rect(0, bandHeight, doc.page.width, 5).fill(palette.primary);

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(palette.secondary).text('OPTIGRID', left, 26, {
        characterSpacing: 2.4, 
        lineBreak: false 
    });
    doc.font('Helvetica-Bold').fontSize(21).fillColor(palette.white).text('ISO 50001 Compliance Report', left, 40, { 
        lineBreak: false 
    });
    doc.font('Helvetica').fontSize(9).fillColor(palette.bandText).text(`${report.report_type}, ${report.standard}`, left, 70, { 
        lineBreak: false 
    });

    const stampWidth = 160;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.secondary).text('REPORTING PERIOD', right - stampWidth, 32, {
            align: 'right', 
            width: stampWidth, 
            characterSpacing: 1, 
            lineBreak: false
        });
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(palette.white).text(report.period.label, right - stampWidth, 45, {
            align: 'right', 
            width: stampWidth, 
            lineBreak: false
        });
    doc.font('Helvetica').fontSize(8.5).fillColor(palette.bandText).text(`Issued ${formatDate(generatedAt)}`, right - stampWidth, 61, {
            align: 'right',
            width: stampWidth,  
            lineBreak: false
        });

    doc.x = left;
    doc.y = bandHeight + 28;

    const drawSectionHeader = (title: string, note?: string) => {
        checkSpacing(56);
        const y = doc.y;
        doc.rect(left, y + 3, 3.5, 14).fill(palette.primary);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(palette.ink).text(title, left + 12, y, { 
            width: contentWidth - 12, 
            lineBreak: false 
        });

        let cursor = y + 18;
        if (note) {
            doc.font('Helvetica').fontSize(8.5).fillColor(palette.muted).text(note, left + 12, cursor, { 
                width: contentWidth - 12 
            });
            cursor = doc.y + 2;
        }

        doc.moveTo(left, cursor + 6).lineTo(right, cursor + 6).lineWidth(0.8).strokeColor(palette.border).stroke();
        doc.x = left;
        doc.y = cursor + 18;
    };

    const drawStatGrid = (items: { label: string; value: string; note?: string; accent?: string }[], perRow: number) => {
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
                        width: tileWidth - 24, 
                        characterSpacing: 0.6, 
                        lineBreak: false
                    });
                doc.font('Helvetica-Bold').fontSize(14).fillColor(palette.ink);
                doc.text(fitText(item.value, tileWidth - 24), x + 14, rowY + 24, {
                    width: tileWidth - 24, 
                    lineBreak: false
                });
                if (item.note) {
                    doc.font('Helvetica').fontSize(7.5).fillColor(palette.muted);
                    doc.text(fitText(item.note, tileWidth - 24), x + 14, rowY + 43, {
                        width: tileWidth - 24, 
                        lineBreak: false
                    });
                }
            });

            doc.x = left;
            doc.y = rowY + tileHeight + gap;
        }

        doc.y += 2;
    };

    const drawTable = (columns: { header: string; width: number; align?: 'left' | 'right' }[], rows: string[][]) => {
        const xPadding = 7;
        const headerHeight = 21;

        const drawHeaderRow = () => {
            const y = doc.y;
            doc.rect(left, y, contentWidth, headerHeight).fill(palette.ink);
            let x = left;
            for (const column of columns) {
                doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.white);
                doc.text(fitText(column.header.toUpperCase(), column.width - xPadding * 2, 0.5), x + xPadding, y + 7.5, {
                    width: column.width - xPadding * 2,
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
            const rowHeight = 20;
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
                const cellWidth = column.width - xPadding * 2;
                doc.text(fitText(row[columnIndex] ?? '', cellWidth), x + xPadding, y + 6.5, {
                    width: cellWidth, 
                    align: column.align ?? 'left', 
                    lineBreak: false
                });
                x += column.width;
            });

            doc.x = left;
            doc.y = y + rowHeight;
        });

        doc.y += 14;
    };

    drawSectionHeader('Energy performance', `Measured across ${report.organisation.buildings_in_scope} ${report.organisation.buildings_in_scope === 1 ? 'site' : 'sites'} over ${report.period.label}, covering all ${report.period.days} days (UTC).`);
    drawStatGrid([
        { 
            label: 'Total consumption', 
            value: `${formatNumber(report.energy_performance.total_usage_kwh)} kWh` 
        },
        { 
            label: 'Average per day', 
            value: `${formatNumber(report.energy_performance.average_daily_kwh)} kWh` 
        },
        { 
            label: 'Energy spend', 
            value: `R ${formatNumber(report.energy_performance.total_cost_zar)}`, accent: palette.secondary 
        },
        {
            label: 'Energy intensity',
            value: report.energy_performance.intensity_kwh_per_sqft === null ? 'No floor data' : `${formatNumber(report.energy_performance.intensity_kwh_per_sqft, 2)}`,
            note: 'kWh per square metre',
            accent: palette.secondary
        },
        {
            label: 'Nonconformities',
            value: `${report.nonconformities.total}`,
            note: `${report.nonconformities.open} still open`,
            accent: report.nonconformities.open > 0 ? palette.danger : palette.success
        },
        {
            label: 'Corrective actions',
            value: `${report.corrective_actions.total}`,
            note: `${report.corrective_actions.implemented} implemented`,
            accent: palette.success
        }
    ], 3);

    drawSectionHeader('Sites in scope', 'Ranked by consumption. Share is the percentage of total portfolio consumption.');
    drawTable(
        [
            {
                header: 'Site', 
                width: 176 
            },
            { 
                header: 'Type', 
                width: 92 
            },
            { 
                header: 'Consumption (kWh)', 
                width: 116, align: 'right' 
            },
            { 
                header: 'Cost (R)', 
                width: 60, align: 'right' 
            },
            { 
                header: 'Share', 
                width: 55, 
                align: 'right' 
            }
        ],
        report.organisation.sites.map((site) => [
            site.name,
            readable(site.type, 'Unspecified'),
            site.usage_kwh === null ? 'No data' : formatNumber(site.usage_kwh),
            site.cost_zar === null ? 'No data' : formatNumber(site.cost_zar),
            site.share_of_total === null ? 'No data' : `${formatNumber(site.share_of_total, 1)}%`
        ])
    );

    drawSectionHeader('Audit trail integrity', 'Every ledger entry is chained to the one before it. Any edit or deletion breaks the chain.');

    const integrity = report.audit_trail.integrity;
    drawStatGrid([
        {
            label: 'Chain status',
            value: integrity.verified ? 'Verified' : 'Broken',
            note: integrity.algorithm,
            accent: integrity.verified ? palette.success : palette.danger
        },
        {
            label: 'Records covered',
            value: formatNumber(integrity.records_checked, 0),
            note: `${formatNumber(report.audit_trail.entries_in_period, 0)} raised this period`
        },
        {
            label: 'Last entry',
            value: integrity.chain_updated_at ? formatShortDate(new Date(integrity.chain_updated_at)) : 'No entries',
            accent: palette.secondary
        }
    ], 3);

    if (integrity.broken_at) {
        checkSpacing(46);
        const warnY = doc.y;
        doc.lineWidth(0.8);
        doc.roundedRect(left, warnY, contentWidth, 36, 5).fillAndStroke('#F7ECEC', palette.danger);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(palette.danger).text(
                `Chain broken at entry ${integrity.broken_at.chain_index} (${readable(integrity.broken_at.reason)})`,
                left + 14, warnY + 13, { 
                    width: contentWidth - 28, 
                    lineBreak: false 
                }
            );
        doc.x = left;
        doc.y = warnY + 50;
    }

    const signatureValue = report.digital_signature.value ?? 'No signature available';
    const signatureHeight = 92;
    checkSpacing(signatureHeight + 10);
    if (doc.y < bottomLimit - signatureHeight - 10) {
        doc.y = Math.max(doc.y, bottomLimit - signatureHeight);
    }

    const signatureY = doc.y;
    doc.lineWidth(1);
    doc.roundedRect(left, signatureY, contentWidth, signatureHeight, 6).fillAndStroke(palette.ink, palette.ink);

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.secondary).text('DIGITAL SIGNATURE', left + 16, signatureY + 14, { 
        characterSpacing: 1.4, 
        lineBreak: false 
    });

    doc.font('Helvetica').fontSize(7.5).fillColor(palette.bandText).text(
            `${report.digital_signature.algorithm} chain head over ${formatNumber(report.digital_signature.records_covered, 0)} ledger entries`, right - 260, signatureY + 14, { 
                align: 'right',
                width: 244,  
                lineBreak: false 
            }
        );

    doc.font('Courier-Bold').fontSize(10).fillColor(palette.white).text(signatureValue, left + 16, signatureY + 34, {
            width: contentWidth - 32,
            characterSpacing: 0.6,
            lineGap: 3
        });

    doc.font('Helvetica').fontSize(7).fillColor(palette.bandText).text('Recompute this value from the audit ledger to confirm the report has not been altered.',
            left + 16, signatureY + signatureHeight - 18, { 
                width: contentWidth - 32, 
                lineBreak: false 
            }
        );

    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index += 1) {
        doc.switchToPage(range.start + index);
        doc.page.margins.bottom = 0;
        const yFooter = doc.page.height - 42;
        doc.moveTo(left, yFooter - 10).lineTo(right, yFooter - 10).lineWidth(0.5).strokeColor(palette.border).stroke();

        doc.font('Helvetica').fontSize(7.5).fillColor(palette.muted).text('OptiGrid ISO 50001 compliance report', left, yFooter, {
            width: contentWidth / 2, 
            lineBreak: false
        });
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(palette.muted).text(`Page ${index + 1} of ${range.count}`, left + contentWidth / 2, yFooter, {
            align: 'right',
            width: contentWidth / 2,  
            lineBreak: false
        });
    }
    doc.end();
};

export const getComplianceReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const allowedBuildingIds = await getAllowedBuildingIds(req);

        if (allowedBuildingIds.length === 0) {
            res.status(404).json({ status: 'error', message: 'No buildings found for user.' });
            return;
        }

        const report = await buildComplianceReport(allowedBuildingIds);
        const format = String(req.query.format ?? 'json').toLowerCase();
        if (format === 'pdf') {
            renderReportPdf(report, res);
            return;
        }

        if (String(req.query.download ?? '') === '1') {
            const periodStart = new Date(report.period.start);
            const fileName = `OptiGrid_ISO50001_Compliance_${periodStart.getUTCFullYear()}-${pad(periodStart.getUTCMonth() + 1)}.json`;
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        }

        res.status(200).json({ status: 'success', data: report });
    } 
    catch (error) {
        console.error('[ComplianceController] Error generating compliance report:', error);
        if (!res.headersSent) {
            res.status(500).json({ status: 'error', message: 'Failed to generate compliance report' });
        }
    }
};