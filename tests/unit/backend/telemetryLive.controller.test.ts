const mockQueryRows = jest.fn();

jest.mock("@influxdata/influxdb-client", () => ({
    InfluxDB: jest.fn().mockImplementation(() => ({
        getQueryApi: jest.fn().mockReturnValue({
            queryRows: (...args: any[]) => mockQueryRows(...args)
        }),
        getWriteApi: jest.fn().mockReturnValue({
            writePoint: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
            flush: jest.fn().mockResolvedValue(undefined)
        })
    })),
    Point: jest.fn()
}));

jest.mock("../../../backend/core/src/lib/prisma", () => ({ __esModule: true, default: {} }));

import { Request, Response } from "express";
import { getLivePortfolioTelemetry } from "../../../backend/core/src/controllers/telemetry.controller";

const rowsFrom = (rows: any[]) => (_query: string, handlers: any) => {
    for (const row of rows) {
        handlers.next([], { toObject: () => row });
    }
    handlers.complete();
};

function runRequest() {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const res = { status: statusMock, json: jsonMock, headersSent: false } as unknown as Response;
    getLivePortfolioTelemetry({} as Request, res);
    return { jsonMock, statusMock };
}

describe("getLivePortfolioTelemetry", () => {
    beforeEach(() => jest.clearAllMocks());

    it("adds up the newest reading from each sensor in a building", () => {
        mockQueryRows.mockImplementation(rowsFrom([
            { building_id: "b1", sensor_id: "s1", _value: 60.5, _time: "2026-09-21T10:00:00Z" },
            { building_id: "b1", sensor_id: "s2", _value: 40, _time: "2026-09-21T10:00:30Z" },
            { building_id: "b2", sensor_id: "s3", _value: 12, _time: "2026-09-21T09:59:00Z" }
        ]));

        const { jsonMock, statusMock } = runRequest();

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "success",
            data: [
                { building_id: "b1", current_kw: 100.5, timestamp: "2026-09-21T10:00:30Z" },
                { building_id: "b2", current_kw: 12, timestamp: "2026-09-21T09:59:00Z" }
            ]
        });
    });

    it("reports the latest moment a building was heard from", () => {
        mockQueryRows.mockImplementation(rowsFrom([
            { building_id: "b1", sensor_id: "s1", _value: 5, _time: "2026-09-21T10:05:00Z" },
            { building_id: "b1", sensor_id: "s2", _value: 5, _time: "2026-09-21T10:01:00Z" }
        ]));

        const { jsonMock } = runRequest();

        expect(jsonMock.mock.calls[0][0].data[0].timestamp).toBe("2026-09-21T10:05:00Z");
    });

    it("limits the timestamp to one reading", () => {
        mockQueryRows.mockImplementation(rowsFrom([
            { building_id: "bld-integration-1", _value: 100.5, _time: "2026-09-21T10:00:00Z" }
        ]));

        const { jsonMock } = runRequest();

        const payload = jsonMock.mock.calls[0][0];
        expect(payload.data[0]).toHaveProperty("timestamp", "2026-09-21T10:00:00Z");
        expect(payload.data[0]).toHaveProperty("current_kw", 100.5);
    });

    it("skips the rows with no building", () => {
        mockQueryRows.mockImplementation(rowsFrom([
            { _value: 9, _time: "2026-09-21T10:00:00Z" },
            { building_id: "b1", _value: 3, _time: "2026-09-21T10:00:00Z" }
        ]));

        const { jsonMock } = runRequest();

        expect(jsonMock.mock.calls[0][0].data).toEqual([
            { building_id: "b1", current_kw: 3, timestamp: "2026-09-21T10:00:00Z" }
        ]);
    });
});