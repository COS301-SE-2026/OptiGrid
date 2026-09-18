import { Request, Response } from 'express';
import prisma from '../lib/prisma';

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

        const baseScore = 75 + Math.random() * 15;
        
        const response = {
            buildingId: building_id,
            score: Math.round(baseScore),
            computedAt: new Date().toISOString(),
            trend: Math.random() > 0.5 ? 1 : 0,
            dimensions: [
                { dimension: "energy_efficiency", label: "Energy Efficiency", score: Math.round(baseScore), weight: 0.35, trend: 1 },
                { dimension: "renewables", label: "Renewable Energy", score: Math.round(baseScore - 10), weight: 0.3, trend: 0 },
                { dimension: "hvacLoad", label: "HVAC Optimization", score: Math.round(baseScore + 5), weight: 0.2, trend: -1 },
                { dimension: "lighting", label: "Lighting Optimization", score: Math.round(baseScore), weight: 0.15, trend: 1 }
            ],
            carbonIntensity: 120 + Math.random() * 30,
            energyHistory: Array.from({length: 12}, () => 400 + Math.random() * 100)
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
            const baselineCarbon = 5000 + Math.random() * 500;
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
