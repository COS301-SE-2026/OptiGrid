import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { InfluxDB } from '@influxdata/influxdb-client';

const url = process.env.INFLUXDB_URL || process.env.INFLUX_URL || 'http://influxdb:8086'; // NOSONAR
const token = process.env.INFLUXDB_TOKEN || process.env.INFLUX_TOKEN || 'dummy';
const org = process.env.INFLUXDB_ORG || process.env.INFLUX_ORG || 'OptiGrid';
const bucket = process.env.INFLUXDB_BUCKET || process.env.INFLUX_BUCKET || 'EnergyData';
const influx = new InfluxDB({ url, token });

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
        res.status(403).json({ status: 'error', message: 'Access Denied: You do not have permission to view this forecast.' });
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

        const queryApi = influx.getQueryApi(org);
        const fluxQuery = `
            from(bucket: "${bucket}")
                |> range(start: -24h)
                |> filter(fn: (r) => r["_measurement"] == "energy_telemetry")
                |> filter(fn: (r) => r["building_id"] == "${building_id}")
                |> filter(fn: (r) => r["_field"] == "voltage_v" or r["_field"] == "current_a" or r["_field"] == "power_kw")
                |> aggregateWindow(every: 15m, fn: mean, createEmpty: false)
                |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
        `;
        
        const rows: any[] = [];
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

        let totalPF = 0;
        let countPF = 0;
        let minPower = Infinity;
        let maxPower = -Infinity;
        let sumPower = 0;
        let countPower = rows.length;

        let daytimePowerSum = 0;
        let daytimeCount = 0;
        let minNightPower = Infinity;
        let morningPeak = 0;
        let middayMin = Infinity;

        for (const row of rows) {
            const v = row.voltage_v || 230;
            const i = row.current_a || 0;
            const p = row.power_kw || 0;
            
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
            const p = row.power_kw || 0;
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
            energyEffScore * 0.35 + 
            renewablesScore * 0.30 + 
            hvacScore * 0.20 + 
            lightingScore * 0.15
        ) || 60;

        const energyHistory = rows.slice(-12).map(r => r.power_kw || 0);

        const response = {
            buildingId: building_id,
            score: finalScore,
            computedAt: new Date().toISOString(),
            trend: 1,
            dimensions: [
                { dimension: "energy_efficiency", label: "Energy Efficiency", score: energyEffScore, weight: 0.35, trend: 1 },
                { dimension: "renewables", label: "Renewable Energy", score: renewablesScore, weight: 0.3, trend: 0 },
                { dimension: "hvacLoad", label: "HVAC Optimization", score: hvacScore, weight: 0.2, trend: 1 },
                { dimension: "lighting", label: "Lighting Optimization", score: lightingScore, weight: 0.15, trend: 1 }
            ],
            carbonIntensity: 120,
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

        const params = req.body;
        
        const energyEff = (params.energyEfficiency || 60) / 100;
        const renewables = (params.renewables || 55) / 100;
        const hvac = (params.hvacLoad || 55) / 100;
        const lighting = (params.lighting || 60) / 100;
        
        const months = params.projectionMonths || 12;
        const forecast = [];
        let currentBaseScore = (energyEff * 0.35 + renewables * 0.3 + hvac * 0.2 + lighting * 0.15) * 100;
        
        for (let i = 0; i < months; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() + i);
            
            const monthStr = date.toISOString().slice(0,7);
            const crypto = require('crypto');
            const baselineCarbon = 5000 + crypto.randomInt(500);
            const scenarioCarbon = baselineCarbon * (1 - (energyEff * 0.2)) * (1 - (renewables * 0.3));
            
            forecast.push({
                month: monthStr,
                baselineScore: Math.round(currentBaseScore - 10), // fake baseline
                scenarioScore: Math.round(currentBaseScore),
                baselineCarbon: Math.round(baselineCarbon),
                scenarioCarbon: Math.round(scenarioCarbon)
            });
        }
        
        const totalCarbonAvoided = forecast.reduce((sum, p) => sum + (p.baselineCarbon - p.scenarioCarbon), 0);
        
        const result = {
            buildingId: building_id,
            params,
            forecast,
            impact: {
                scoreDelta: Math.round(currentBaseScore - (currentBaseScore - 10)),
                totalCarbonAvoided: Math.round(totalCarbonAvoided),
                equivalentTrees: Math.round(totalCarbonAvoided / 21),
                carbonReduction: Math.round((totalCarbonAvoided / forecast.reduce((sum, p) => sum + p.baselineCarbon, 0)) * 100),
                estimatedCostSavings: Math.round(totalCarbonAvoided * 0.15)
            }
        };

        return res.status(200).json(result);
    } catch (error) {
        console.error("ESG Simulation failed:", error);
        return res.status(500).json({ status: 'error', message: 'Failed to simulate ESG scenario' });
    }
};
