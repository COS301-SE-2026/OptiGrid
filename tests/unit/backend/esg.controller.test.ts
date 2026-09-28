import { Request, Response } from 'express';
import { getEsgHealthScoreController, simulateEsgScenarioController } from '../../../backend/core/src/controllers/esg.controller';
import prisma from '../../../backend/core/src/lib/prisma';
import { InfluxDB } from '@influxdata/influxdb-client';

// Mock Prisma
jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		building: {
			findMany: jest.fn(),
			findUnique: jest.fn(),
		},
		carbonLedgerEntry: {
			findFirst: jest.fn(),
			findMany: jest.fn(),
		},
	},
}));

// Mock InfluxDB
jest.mock('@influxdata/influxdb-client', () => {
    return {
        InfluxDB: jest.fn().mockImplementation(() => {
            return {
                getQueryApi: jest.fn().mockReturnValue({
                    queryRows: jest.fn((_query, observer) => observer.complete())
                })
            };
        })
    };
});

describe('ESG Controller Unit Tests', () => {
    const mockUserId = 'user-123';
    const mockBuildingId = '11111111-1111-4111-8111-111111111111';

    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        
        req = {
            params: { building_id: mockBuildingId },
            user: { id: mockUserId } as any,
            body: {}
        };
        
        res = {
            status: statusMock,
            json: jsonMock,
        };

        // Mock authorization to always succeed
        (prisma.building.findMany as jest.Mock).mockResolvedValue([{ building_id: mockBuildingId }]);
        (prisma.carbonLedgerEntry.findFirst as jest.Mock).mockResolvedValue({
            period_date: new Date('2026-09-01T00:00:00.000Z'),
            total_kwh: 100,
            total_kg_co2e: 93,
            emission_factor_kg_co2e_per_kwh: 0.93,
            integrity_status: 'VALID'
        });
        (prisma.carbonLedgerEntry.findMany as jest.Mock).mockResolvedValue([{
            total_kwh: 100,
            total_kg_co2e: 93,
            emission_factor_kg_co2e_per_kwh: 0.93
        }]);
    });

    describe('getEsgHealthScoreController', () => {
        it('should return 401 if user is not authenticated', async () => {
            req.user = undefined;
            await getEsgHealthScoreController(req as Request, res as Response);
            
            expect(statusMock).toHaveBeenCalledWith(401);
            expect(jsonMock).toHaveBeenCalledWith({ status: 'error', message: 'Unauthorized' });
        });

        it('should return 400 if building ID is invalid', async () => {
            req.params = { building_id: 'invalid-id' };
            await getEsgHealthScoreController(req as Request, res as Response);
            
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({ status: 'error', message: 'Building ID must be a valid UUID or legacy building id.' });
        });

        it('should return 403 if user is not authorized for building', async () => {
            (prisma.building.findMany as jest.Mock).mockResolvedValue([]); // Mock empty response meaning no access
            await getEsgHealthScoreController(req as Request, res as Response);
            
            expect(statusMock).toHaveBeenCalledWith(403);
            expect(jsonMock).toHaveBeenCalledWith({ status: 'error', message: 'Access Denied: You do not have permission to view this building.' });
        });

        it('should correctly calculate ESG health score from valid InfluxDB data', async () => {
            // Mock InfluxDB query to simulate data over the last 30 days
            const mockQueryRows = jest.fn((query: any, observer: any) => {
                const rows = [
                    { _time: new Date('2026-09-01T08:00:00Z').toISOString(), power_kw: 100, apparent_power_kva: 110 },
                    { _time: new Date('2026-09-01T12:00:00Z').toISOString(), power_kw: 80, apparent_power_kva: 85 }, // lower at midday
                    { _time: new Date('2026-09-01T18:00:00Z').toISOString(), power_kw: 90, apparent_power_kva: 95 }
                ];
                rows.forEach(row => observer.next(row, { toObject: () => row }));
                observer.complete();
            });

            // Re-apply the mock implementation for this test
            (InfluxDB as unknown as jest.Mock).mockImplementation(() => ({
                getQueryApi: jest.fn().mockReturnValue({
                    queryRows: mockQueryRows
                })
            }));

            // We must re-import the controller because it instantiates InfluxDB on module load
            jest.isolateModules(async () => {
                const { getEsgHealthScoreController } = require('../../../backend/core/src/controllers/esg.controller');
                await getEsgHealthScoreController(req as Request, res as Response);
    
                expect(statusMock).toHaveBeenCalledWith(200);
                expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                    buildingId: mockBuildingId,
                    score: expect.any(Number),
                    dimensions: expect.arrayContaining([
                        expect.objectContaining({ dimension: 'energy_efficiency' }),
                        expect.objectContaining({ dimension: 'renewables' }),
                        expect.objectContaining({ dimension: 'hvacLoad' }),
                        expect.objectContaining({ dimension: 'lighting' })
                    ]),
                    carbonIntensity: 0.93,
                    carbonAccounting: expect.objectContaining({
                        source: 'carbon_ledger',
                        integrityStatus: 'VALID'
                    }),
                    scoreLabel: 'Operational environmental proxy',
                    scope: {
                        primaryPillar: 'environmental',
                        energyEvidence: 'telemetry_derived',
                        carbonEvidence: 'ledger_backed',
                        governanceEvidence: 'carbon_ledger_integrity_only',
                        socialMetrics: 'not_included'
                    },
                    energyHistory: expect.any(Array)
                }));
            });
        });

        it('reports carbon as unavailable instead of inventing a value', async () => {
            (prisma.carbonLedgerEntry.findFirst as jest.Mock).mockResolvedValue(null);

            await getEsgHealthScoreController(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                carbonIntensity: null,
                carbonAccounting: expect.objectContaining({
                    source: 'unavailable',
                    integrityStatus: 'UNAVAILABLE'
                }),
                scope: expect.objectContaining({
                    energyEvidence: 'fallback_defaults',
                    carbonEvidence: 'unavailable',
                    governanceEvidence: 'unavailable',
                    socialMetrics: 'not_included'
                })
            }));
            const payload = jsonMock.mock.calls[0][0];
            const weightedScore = Math.round(payload.dimensions.reduce(
                (sum: number, dimension: { score: number; weight: number }) => sum + dimension.score * dimension.weight,
                0
            ));
            expect(payload.score).toBe(weightedScore);
            expect(payload.trend).toBe(0);
        });
    });

    describe('simulateEsgScenarioController', () => {
        it('should correctly calculate scenario metrics with provided inputs', async () => {
            req.body = {
                energyEfficiency: 80, // 0.8
                renewables: 90, // 0.9
                hvacLoad: 40, // 0.4
                lighting: 30, // 0.3
                projectionMonths: 12
            };

            await simulateEsgScenarioController(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            
            // Expected Base Score: (0.8 * 0.35 + 0.9 * 0.3 + 0.4 * 0.2 + 0.3 * 0.15) * 100
            // = (0.28 + 0.27 + 0.08 + 0.045) * 100 = 0.675 * 100 = 67.5 => 68
            expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
                buildingId: mockBuildingId,
                impact: expect.objectContaining({
                    scoreDelta: 10,
                    totalCarbonAvoided: expect.any(Number),
                    equivalentTrees: expect.any(Number),
                    carbonReduction: expect.any(Number)
                }),
                forecast: expect.any(Array),
                methodology: expect.objectContaining({
                    deterministic: true,
                    baselineSource: 'carbon_ledger',
                    ledgerDays: 1
                })
            }));
            
            const payload = jsonMock.mock.calls[0][0];
            expect(payload.forecast).toHaveLength(12);
        });

        it('should use default values if inputs are missing', async () => {
            req.body = {}; // Missing inputs
            await simulateEsgScenarioController(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(200);
            
            const payload = jsonMock.mock.calls[0][0];
            // Verify fallback defaults work
            expect(payload.forecast[0].scenarioScore).toBe(58);
            expect(payload.impact.totalCarbonAvoided).toBe(0);
        });

        it('returns identical results for identical inputs', async () => {
            req.body = { energyEfficiency: 80, renewables: 70, projectionMonths: 3 };
            await simulateEsgScenarioController(req as Request, res as Response);
            const first = jsonMock.mock.calls[0][0];

            jsonMock.mockClear();
            await simulateEsgScenarioController(req as Request, res as Response);
            const second = jsonMock.mock.calls[0][0];

            expect(second).toEqual(first);
        });

        it('rejects percentages outside the supported range', async () => {
            req.body = { energyEfficiency: 101 };

            await simulateEsgScenarioController(req as Request, res as Response);

            expect(statusMock).toHaveBeenCalledWith(400);
            expect(prisma.carbonLedgerEntry.findMany).not.toHaveBeenCalled();
        });

        it('marks carbon and cost projections unavailable without a signed ledger baseline', async () => {
            (prisma.carbonLedgerEntry.findMany as jest.Mock).mockResolvedValue([]);
            req.body = { projectionMonths: 2 };

            await simulateEsgScenarioController(req as Request, res as Response);

            const payload = jsonMock.mock.calls[0][0];
            expect(payload.forecast).toHaveLength(2);
            expect(payload.forecast[0].baselineCarbon).toBeNull();
            expect(payload.impact.totalCarbonAvoided).toBeNull();
            expect(payload.impact.estimatedCostSavings).toBeNull();
            expect(payload.methodology).toEqual(expect.objectContaining({
                baselineSource: 'unavailable',
                ledgerDays: 0,
                baselineMonthlyKwh: null,
                baselineMonthlyKgCo2e: null
            }));
        });
    });
});
