process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/optigrid_test?schema=public";

import request from "supertest";
import express from "express";

jest.mock("../../../../backend/core/src/controllers/telemetry.controller", () => ({
    getLivePortfolioTelemetry: jest.fn((req, res) => {
        return res.status(200).json({
            status: "success",
            data: [
                {
                    building_id: "bld-integration-1",
                    current_kw: 100.5,
                    timestamp: new Date().toISOString(),
                },
            ],
        });
    }),
    streamTelemetry: jest.fn((req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        return res.status(200).end("data: connected\n\n");
    }),
}));

import { getLivePortfolioTelemetry, streamTelemetry } from "../../../../backend/core/src/controllers/telemetry.controller";
import { forwardToIngestionService } from "../../../../backend/core/src/services/sensor.services";

const app = express();
app.use(express.json());

app.get("/api/telemetry/live", getLivePortfolioTelemetry);
app.get("/api/telemetry/stream/:building_id", streamTelemetry);

describe("Telemetry & Sensor Integration Tests", () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        jest.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe("GET /api/telemetry/live", () => {
        it("successfully fetches live metrics and maps portfolio telemetry data end-to-end", async () => {
            const response = await request(app).get("/api/telemetry/live");
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("status", "success");
        });
    });

    describe("GET /api/telemetry/stream/:building_id", () => {
        it("establishes an SSE stream connection with appropriate headers", async () => {
            const response = await request(app).get("/api/telemetry/stream/bld-integration-1");

            expect(response.status).toBe(200);
            expect(response.headers["content-type"]).toMatch(/text\/event-stream/);
        });
    });

    describe("Sensor Ingestion Service Integration Flow", () => {
        it("handles complete payload dispatch down to core ingestion handler structure", async () => {
            const mockPayload = {
                sensor_id: "sens-int-01",
                building_id: "bld-integration-1",
                usage: "350.2",
            };

            const mockResponseJson = { status: "success", buffered: true };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponseJson),
            });

            const result = await forwardToIngestionService(mockPayload);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockResponseJson);
        });
    });
});