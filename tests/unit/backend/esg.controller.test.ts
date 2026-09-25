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
	},
}));

// Mock InfluxDB
jest.mock('@influxdata/influxdb-client', () => {
    return {
        InfluxDB: jest.fn().mockImplementation(() => {
            return {
                getQueryApi: jest.fn().mockReturnValue({
                    queryRows: jest.fn()
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
            expect(jsonMock).toHaveBeenCalledWith({ status: 'error', message: 'Access Denied: You do not have permission to view this forecast.' });
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
                    carbonIntensity: expect.any(Number),
                    energyHistory: expect.any(Array)
                }));
            });
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
                    scoreDelta: expect.any(Number),
                    totalCarbonAvoided: expect.any(Number),
                    equivalentTrees: expect.any(Number),
                    carbonReduction: expect.any(Number)
                }),
                forecast: expect.any(Array)
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
            expect(payload.forecast[0].scenarioScore).toBe(57);
        });
    });
});
