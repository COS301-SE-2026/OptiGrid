import { Request, Response } from "express";
import { streamTelemetry, getLivePortfolioTelemetry } from "../../../backend/core/src/controllers/telemetry.controller";
import { sseManager } from "../../../backend/core/src/utils/sseManager";

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
        mockRequest = {};
        mockResponse = {
            setHeader: jest.fn(),
            flushHeaders: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            headersSent: false,
        };
    });

    describe("streamTelemetry", () => {
        it("configures SSE headers and registers the client with sseManager", () => {
            mockRequest.params = { building_id: "bld-999" };

            streamTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
            expect(mockResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
            expect(mockResponse.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
            expect(mockResponse.flushHeaders).toHaveBeenCalled();
            expect(sseManager.addClient).toHaveBeenCalledWith("bld-999", mockResponse);
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

        it("returns graceful empty dataset when InfluxDB query fails", () => {
            (mockInfluxQueryApi.queryRows as jest.Mock).mockImplementation((query, callbacks) => {
                callbacks.error(new Error("InfluxDB connection failed"));
            });

            await getLivePortfolioTelemetry(mockRequest as Request, mockResponse as Response);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            expect(mockResponse.json).toHaveBeenCalledWith({
                status: "success",
                data: [],
            });
        });
    });
});