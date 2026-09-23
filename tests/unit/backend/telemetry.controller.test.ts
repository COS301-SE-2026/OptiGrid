import { Request, Response } from "express";
import { streamTelemetry, getLivePortfolioTelemetry } from "../../../backend/core/src/controllers/telemetry.controller";
import { sseManager } from "../../../backend/core/src/utils/sseManager";

const mockAssertBuildingAccess = jest.fn();

jest.mock("../../../backend/core/src/services/sensor.services", () => ({
    assertBuildingAccess: (...args: unknown[]) => mockAssertBuildingAccess(...args),
}));

jest.mock("../../../backend/core/src/utils/sseManager", () => ({
    sseManager: {
        addClient: jest.fn(),
        broadcast: jest.fn(),
    },
}));

// Mock InfluxDB module
const mockQueryRows = jest.fn();

jest.mock("@influxdata/influxdb-client", () => ({
    InfluxDB: jest.fn().mockImplementation(() => ({
        getQueryApi: jest.fn().mockReturnValue({
            queryRows: (...args: any[]) => mockQueryRows(...args),
        }),
        getWriteApi: jest.fn().mockReturnValue({
            writePoint: jest.fn(),
            flush: jest.fn().mockResolvedValue(undefined),
        }),
    })),
    Point: jest.fn().mockImplementation(() => ({
        tag: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
    })),
}));

describe("Telemetry Controller Unit Tests", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAssertBuildingAccess.mockResolvedValue(undefined);
        mockRequest = {
            user: {
                id: "user-1",
                roleType: "VIEWER",
                user_metadata: { tenant_id: "tenant-1" },
            },
        };
        mockResponse = {
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            headersSent: false,
        };
    });

    describe("streamTelemetry", () => {
        it("authorizes building access before registering the SSE client", async () => {
            mockRequest.params = { building_id: "bld-999" };

            await streamTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockAssertBuildingAccess).toHaveBeenCalledWith("user-1", "bld-999", "VIEWER");
            expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
            expect(mockResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
            expect(mockResponse.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
            expect(mockResponse.flushHeaders).toHaveBeenCalled();
            expect(sseManager.addClient).toHaveBeenCalledWith("bld-999", mockResponse);
        });

        it("returns 403 without opening a stream when building access is denied", async () => {
            mockRequest.params = { building_id: "bld-denied" };
            mockAssertBuildingAccess.mockRejectedValue(
                new Error("Access Denied. You do not have permission to access this building."),
            );

            await streamTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.setHeader).not.toHaveBeenCalled();
            expect(sseManager.addClient).not.toHaveBeenCalled();
        });

        it("returns 401 when no authenticated user is present", async () => {
            mockRequest.user = undefined;
            mockRequest.params = { building_id: "bld-999" };

            await streamTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockAssertBuildingAccess).not.toHaveBeenCalled();
            expect(sseManager.addClient).not.toHaveBeenCalled();
        });
    });

    describe("getLivePortfolioTelemetry", () => {
        it("returns HTTP 200 with mapped telemetry data on successful InfluxDB query", () => {
            mockQueryRows.mockImplementation((query, callbacks) => {
                const mockRow = {};
                const mockTableMeta = {
                    toObject: jest.fn().mockReturnValue({
                        building_id: "bld-1",
                        _value: 52.4,
                        _time: "2026-07-28T10:30:00.000Z",
                    }),
                };

                // Trigger callback iteration
                callbacks.next(mockRow, mockTableMeta);
                callbacks.complete();
            });

            getLivePortfolioTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                status: "success",
                data: [
                    {
                        building_id: "bld-1",
                        current_kw: 52.4,
                        timestamp: "2026-07-28T10:30:00.000Z",
                    },
                ],
            });
        });

        it("returns graceful empty dataset when InfluxDB query fails", async () => {
            mockQueryRows.mockImplementation((query, callbacks) => {
                callbacks.error(new Error("InfluxDB connection failed"));
            });

            await getLivePortfolioTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                status: "success",
                data: [],
            });
        });

        it('returns an empty dataset when starting the Influx query throws', () => {
            mockQueryRows.mockImplementation(() => {
                throw new Error('query setup failed');
            });
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
            try {
                getLivePortfolioTelemetry(mockRequest as Request, mockResponse as Response);
            } finally {
                warn.mockRestore();
            }
            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({ status: 'success', data: [] });
        });
    });
});
