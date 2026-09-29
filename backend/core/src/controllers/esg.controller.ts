import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { InfluxDB } from '@influxdata/influxdb-client';
import { z } from 'zod';
import { UTILITY_COST_ZAR_PER_KWH } from '../lib/influx';

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || 'http://influxdb:8086'; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'dummy';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'OptiGrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'EnergyData';
const influx = new InfluxDB({ url, token });

const toIsoDate = (value: Date | string): string => new Date(value).toISOString().slice(0, 10);
const DEFAULT_SCENARIO = {
    energyEfficiency: 60,
    renewables: 55,
    hvacLoad: 55,
    lighting: 60
} as const;
const percentage = z.coerce.number().finite().min(0).max(100);
const scenarioSchema = z.object({
    energyEfficiency: percentage.default(DEFAULT_SCENARIO.energyEfficiency),
    renewables: percentage.default(DEFAULT_SCENARIO.renewables),
    hvacLoad: percentage.default(DEFAULT_SCENARIO.hvacLoad),
    lighting: percentage.default(DEFAULT_SCENARIO.lighting),
    projectionMonths: z.coerce.number().int().min(1).max(60).default(12)
});

type ScenarioControls = z.infer<typeof scenarioSchema>;

const clamp = (value: number, minimum: number, maximum: number): number =>
    Math.max(minimum, Math.min(maximum, value));

const weightedEnvironmentalScore = (controls: ScenarioControls): number => Math.round(
    controls.energyEfficiency * 0.35
    + controls.renewables * 0.30
    + controls.hvacLoad * 0.20
    + controls.lighting * 0.15
);

const scenarioReductionFactor = (controls: ScenarioControls): number => {
    const efficiencyChange = (controls.energyEfficiency - DEFAULT_SCENARIO.energyEfficiency) / 100;
    const renewableChange = (controls.renewables - DEFAULT_SCENARIO.renewables) / 100;
    const hvacChange = (controls.hvacLoad - DEFAULT_SCENARIO.hvacLoad) / 100;
    const lightingChange = (controls.lighting - DEFAULT_SCENARIO.lighting) / 100;
    const energyReduction = clamp(
        efficiencyChange * 0.20 + hvacChange * 0.10 + lightingChange * 0.05,
        -0.35,
        0.35
    );
    const renewableOffset = clamp(renewableChange * 0.30, -0.30, 0.30);
    return clamp(1 - (1 - energyReduction) * (1 - renewableOffset), -0.50, 0.50);
};

const authorizeBuildingAccess = async (userId: string | undefined, buildingId: string, res: Response): Promise<boolean> => {
    if (!userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return false;
    }
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const LEGACY_BUILDING_PATTERN = /^(bld_|building_)[a-z0-9_-]+$/i;
    const isValidBuildingId = (id: string) => UUID_PATTERN.test(id) || LEGACY_BUILDING_PATTERN.test(id);
    
    if (!isValidBuildingId(buildingId)) {
        res.status(400).json({ status: 'error', message: 'Building ID must be a valid UUID or legacy building id.' });
        return false;
    }
    const authorizedBuildings = await prisma.building.findMany({
        where: { authorized_users: { some: { user_id: userId } } },
        select: { building_id: true }
    });
    if (!authorizedBuildings.some(b => b.building_id === buildingId)) {
        res.status(403).json({ status: 'error', message: 'Access Denied: You do not have permission to view this building.' });
        return false;
    }
    return true;
};

export const getEsgHealthScoreController = async (req: Request, res: Response) => {
    try {
        const { building_id } = req.params;
        const isAuth = await authorizeBuildingAccess(req.user?.id, building_id, res);
        if (!isAuth) return;

        // Fetch building square footage
        const building = await prisma.building.findUnique({
            where: { building_id },
            select: { square_footage: true }
        });
        const squareFootage = building?.square_footage ? Number(building.square_footage) : 10000; // default 10k sqft
        const carbonEntry = await prisma.carbonLedgerEntry.findFirst({
            where: {
                building_id,
                reading_count: { gt: 0 },
                integrity_status: { not: 'TAMPERED' }
            },
            orderBy: { period_date: 'desc' },
            select: {
                period_date: true,
                total_kwh: true,
                total_kg_co2e: true,
                emission_factor_kg_co2e_per_kwh: true,
                integrity_status: true
            }
        });

        const queryApi = influx.getQueryApi(org);
        const fluxQuery = `
            from(bucket: "${bucket}")
                |> range(start: -24h)
                |> filter(fn: (r) => r["_measurement"] == "energy_telemetry")
                |> filter(fn: (r) => r["building_id"] == "${building_id}")
                |> filter(fn: (r) => r["_field"] == "voltage_v" or r["_field"] == "current_a" or r["_field"] == "power_kw" or r["_field"] == "usage")
                |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
                |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        `;
        
        const rows: any[] = [];
        try {
            await new Promise((resolve, reject) => {
                queryApi.queryRows(fluxQuery, {
                    next(row, tableMeta) {
                        rows.push(tableMeta.toObject(row));
                    },
                    error(error) {
                        reject(error);
                    },
                    complete() {
                        resolve(true);
                    },
                });
            });
        } catch {
            // Carbon-ledger evidence remains useful when live telemetry is unavailable.
            // Clear partial rows so the response is explicitly marked as fallback-based.
            rows.length = 0;
        }

        let totalPF = 0;
        let countPF = 0;
        let minPower = Infinity;
        let maxPower = -Infinity;
        let sumPower = 0;
        const countPower = rows.length;

        let daytimePowerSum = 0;
        let daytimeCount = 0;
        let minNightPower = Infinity;
        let morningPeak = 0;
        let middayMin = Infinity;

        for (const row of rows) {
            const v = row.voltage_v || 230;
            const i = row.current_a || 0;
            const p = row.power_kw || row.usage || 0;
            
            // 1. Power Factor (Energy Efficiency)
            const apparent = (v * i) / 1000;
            if (apparent > 0) {
                const pf = Math.min(Math.max(p / apparent, 0), 1);
                totalPF += pf;
                countPF++;
            }

            // Stats
            if (p < minPower) minPower = p;
            if (p > maxPower) maxPower = p;
            sumPower += p;
            
            const date = new Date(row._time);
            const hour = date.getUTCHours();
            
            // Daytime vs Nighttime (assume UTC local alignment for simplicity)
            if (hour >= 8 && hour <= 18) {
                daytimePowerSum += p;
                daytimeCount++;
            } else if (p < minNightPower) {
                minNightPower = p;
            }
            
            // Solar Duck Curve
            if (hour >= 6 && hour <= 10 && p > morningPeak) {
                morningPeak = p;
            }
            if (hour >= 11 && hour <= 15 && p < middayMin) {
                middayMin = p;
            }
        }

        const avgPower = countPower > 0 ? sumPower / countPower : 0;
        let varianceSum = 0;
        for (const row of rows) {
            const p = row.power_kw || row.usage || 0;
            varianceSum += Math.pow(p - avgPower, 2);
        }
        const stdDev = countPower > 0 ? Math.sqrt(varianceSum / countPower) : 0;
        
        const avgDaytime = daytimeCount > 0 ? daytimePowerSum / daytimeCount : avgPower;
        const baseNight = minNightPower === Infinity ? 0 : minNightPower;

        // 1. Energy Efficiency
        const avgPF = countPF > 0 ? totalPF / countPF : 0.85; // default 85% if no data
        const energyEffScore = Math.round(avgPF * 100) || 85;

        // 2. HVAC Optimization
        let hvacScore = 60;
        if (avgPower > 0) {
            const cv = stdDev / avgPower;
            hvacScore = Math.max(0, Math.min(100, Math.round(100 - (cv * 100))));
        }

        // 3. Lighting Optimization
        const lightingLoadKw = Math.max(0, avgDaytime - baseNight);
        const lightingDensityWsqft = (lightingLoadKw * 1000) / squareFootage;
        let lightingScore = 100 - ((lightingDensityWsqft - 0.5) / 1.5) * 100;
        lightingScore = Number.isNaN(lightingScore) ? 60 : Math.max(0, Math.min(100, Math.round(lightingScore)));

        // 4. Renewables
        let renewablesScore = 0;
        if (morningPeak > 0 && middayMin !== Infinity) {
            const offsetRatio = (morningPeak - middayMin) / morningPeak;
            renewablesScore = Math.max(0, Math.min(100, Math.round(offsetRatio * 100)));
        }

        const finalScore = Math.round(
            energyEffScore * 0.50 + 
            renewablesScore * 0.10 + 
            hvacScore * 0.25 + 
            lightingScore * 0.15
        );

        const energyHistory = rows.slice(-12).map(r => r.power_kw || r.usage || 0);
        const carbonKwh = Number(carbonEntry?.total_kwh ?? 0);
        const carbonKgCo2e = Number(carbonEntry?.total_kg_co2e ?? 0);
        const carbonIntensity = carbonEntry && carbonKwh > 0
            ? Number((carbonKgCo2e / carbonKwh).toFixed(6))
            : null;

        const response = {
            buildingId: building_id,
            score: finalScore,
            scoreLabel: 'Operational environmental proxy',
            computedAt: new Date().toISOString(),
            trend: 0,
            dimensions: [
                { dimension: "energy_efficiency", label: "Energy Efficiency", score: energyEffScore, weight: 0.50, trend: 0 },
                { dimension: "renewables", label: "Renewable Energy", score: renewablesScore, weight: 0.10, trend: 0 },
                { dimension: "hvacLoad", label: "HVAC Optimization", score: hvacScore, weight: 0.25, trend: 0 },
                { dimension: "lighting", label: "Lighting Optimization", score: lightingScore, weight: 0.15, trend: 0 }
            ],
            carbonIntensity,
            carbonAccounting: carbonEntry ? {
                source: 'carbon_ledger',
                periodDate: toIsoDate(carbonEntry.period_date),
                totalKwh: carbonKwh,
                totalKgCo2e: carbonKgCo2e,
                emissionFactorKgCo2ePerKwh: Number(carbonEntry.emission_factor_kg_co2e_per_kwh),
                integrityStatus: carbonEntry.integrity_status
            } : {
                source: 'unavailable',
                periodDate: null,
                totalKwh: null,
                totalKgCo2e: null,
                emissionFactorKgCo2ePerKwh: null,
                integrityStatus: 'UNAVAILABLE'
            },
            scope: {
                primaryPillar: 'environmental',
                energyEvidence: countPower > 0 ? 'telemetry_derived' : 'fallback_defaults',
                carbonEvidence: carbonEntry ? 'ledger_backed' : 'unavailable',
                governanceEvidence: carbonEntry ? 'carbon_ledger_integrity_only' : 'unavailable',
                socialMetrics: 'not_included'
            },
            energyHistory: energyHistory.length ? energyHistory : [400, 450, 420]
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error("ESG Health Score failed:", error);
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve ESG health score' });
    }
};

export const simulateEsgScenarioController = async (req: Request, res: Response) => {
    try {
        const { building_id } = req.params;
        const isAuth = await authorizeBuildingAccess(req.user?.id, building_id, res);
        if (!isAuth) return;

        const parsed = scenarioSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            return res.status(400).json({
                status: 'error',
                message: 'Scenario inputs must be percentages from 0 to 100 and projectionMonths must be from 1 to 60.'
            });
        }
        const params = parsed.data;
        const ledgerRows = await prisma.carbonLedgerEntry.findMany({
            where: {
                building_id,
                reading_count: { gt: 0 },
                integrity_status: { not: 'TAMPERED' }
            },
            orderBy: { period_date: 'desc' },
            take: 30,
            select: {
                total_kwh: true,
                total_kg_co2e: true
            }
        });
        const ledgerDays = ledgerRows.length;
        const monthlyScale = ledgerDays > 0 ? 30 / ledgerDays : 0;
        const baselineMonthlyKwh = ledgerDays > 0
            ? ledgerRows.reduce((sum, row) => sum + Number(row.total_kwh), 0) * monthlyScale
            : null;
        const baselineMonthlyCarbon = ledgerDays > 0
            ? ledgerRows.reduce((sum, row) => sum + Number(row.total_kg_co2e), 0) * monthlyScale
            : null;
        const baselineScore = weightedEnvironmentalScore({
            ...DEFAULT_SCENARIO,
            projectionMonths: params.projectionMonths
        });
        const scenarioScore = weightedEnvironmentalScore(params);
        const reductionFactor = scenarioReductionFactor(params);
        const months = params.projectionMonths;
        const forecast = [];
        
        for (let i = 0; i < months; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() + i);
            
            const monthStr = date.toISOString().slice(0,7);
            const scenarioCarbon = baselineMonthlyCarbon === null
                ? null
                : baselineMonthlyCarbon * (1 - reductionFactor);
            
            forecast.push({
                month: monthStr,
                baselineScore,
                scenarioScore,
                baselineCarbon: baselineMonthlyCarbon === null ? null : Math.round(baselineMonthlyCarbon),
                scenarioCarbon: scenarioCarbon === null ? null : Math.round(scenarioCarbon)
            });
        }
        
        const totalCarbonAvoided = baselineMonthlyCarbon === null
            ? null
            : baselineMonthlyCarbon * reductionFactor * months;
        const totalEnergyAvoided = baselineMonthlyKwh === null
            ? null
            : baselineMonthlyKwh * reductionFactor * months;
        
        const result = {
            buildingId: building_id,
            params,
            forecast,
            impact: {
                scoreDelta: scenarioScore - baselineScore,
                totalCarbonAvoided: totalCarbonAvoided === null ? null : Math.round(totalCarbonAvoided),
                equivalentTrees: totalCarbonAvoided === null ? null : Math.round(totalCarbonAvoided / 21),
                carbonReduction: Math.round(reductionFactor * 100),
                estimatedCostSavings: totalEnergyAvoided === null
                    ? null
                    : Math.round(totalEnergyAvoided * UTILITY_COST_ZAR_PER_KWH)
            },
            methodology: {
                deterministic: true,
                baselineSource: ledgerDays > 0 ? 'carbon_ledger' : 'unavailable',
                ledgerDays,
                baselineMonthlyKwh: baselineMonthlyKwh === null ? null : Number(baselineMonthlyKwh.toFixed(2)),
                baselineMonthlyKgCo2e: baselineMonthlyCarbon === null ? null : Number(baselineMonthlyCarbon.toFixed(2)),
                estimatedTariffZarPerKwh: UTILITY_COST_ZAR_PER_KWH
            }
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error("ESG Simulation failed:", error);
        return res.status(500).json({ status: 'error', message: 'Failed to simulate ESG scenario' });
    }
};
