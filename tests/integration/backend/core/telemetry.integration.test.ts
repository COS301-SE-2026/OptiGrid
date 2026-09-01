import request from "supertest";
import { createCoreApiHarness, getAuthHeaders } from "./harness/core-api-harness";
import type { CoreApiHarness } from "./harness/core-api-harness";
import { startInfluxHarness, stopInfluxHarness } from "./harness/influx-container";
import type { StartedInfluxHarness } from "./harness/influx-container";
import { InfluxDB, Point } from "@influxdata/influxdb-client";
import { forwardToIngestionService } from "../../../../backend/core/src/services/sensor.services";

describe("Telemetry Integration Tests", () => {
    let harness: CoreApiHarness;
    let influxHarness: StartedInfluxHarness;
    let authHeaders: { Cookie: string };
    const userId = "bbe48b78-438f-4ed7-9fe7-a8fc9addc187";
    const buildingId = "bld-integration-1";

    beforeAll(async () => {
        influxHarness = await startInfluxHarness();
        process.env.INFLUXDB_URL = influxHarness.url;
        process.env.INFLUX_URL = influxHarness.url;
        process.env.INFLUXDB_TOKEN = influxHarness.token;
        process.env.INFLUXDB_ORG = influxHarness.org;
        process.env.INFLUXDB_BUCKET = influxHarness.bucket;

        harness = await createCoreApiHarness();
        authHeaders = await getAuthHeaders(userId);
    }, 120000);

    afterAll(async () => {
        if (harness) await harness.stop();
        if (influxHarness) await stopInfluxHarness(influxHarness);
        
        try {
            const { shutdownTelemetry } = await import("../../../../backend/core/src/controllers/telemetry.controller");
            await shutdownTelemetry();
        } catch (e) {
            console.error("Failed to shutdown telemetry", e);
        }
    });

    afterEach(async () => {
        if (harness) await harness.resetDatabase();
    });

    describe("GET /api/telemetry/live", () => {
        it("successfully fetches live metrics and maps portfolio telemetry data end-to-end", async () => {
            // seed data directly to influx
            const client = new InfluxDB({ url: influxHarness.url, token: influxHarness.token });
            const writeApi = client.getWriteApi(influxHarness.org, influxHarness.bucket, "ms");
            
            const p1 = new Point("energy_telemetry")
                .tag("building_id", buildingId)
                .floatField("power_kw", 100.5)
                .timestamp(new Date());
                
            writeApi.writePoint(p1);
            await writeApi.close();

            const response = await request(harness.app)
                .get("/api/telemetry/live")
                .set(authHeaders);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty("status", "success");
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data[0]).toHaveProperty("building_id", buildingId);
            expect(response.body.data[0]).toHaveProperty("current_kw", 100.5);
            expect(response.body.data[0]).toHaveProperty("timestamp");
        });
    });

    describe("GET /api/telemetry/stream/:building_id", () => {
        it("establishes an SSE stream connection with appropriate headers", (done) => {
            console.log("Starting SSE stream test...");
            const server = harness.app.listen(0, () => {
                const port = (server.address() as any).port;
                console.log(`Ephemeral server listening on port ${port} for SSE test`);
                
                const http = require('http');
                const req = http.get(`http://localhost:${port}/api/telemetry/stream/${buildingId}`, {
                    headers: authHeaders
                }, (res: any) => {
                    console.log("Received response from SSE endpoint, status:", res.statusCode);
                    
                    try {
                        expect(res.statusCode).toBe(200);
                        expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
                    } catch (e) {
                        res.destroy();
                        server.close();
                        return done(e);
                    }
                    
                    res.destroy();
                    server.close(done);
                    console.log("SSE stream test completed successfully");
                });
                
                req.on('error', (err: any) => {
                    console.error("SSE request error:", err);
                    server.close(() => done(err));
                });
            });
        });
    });

    describe("Sensor Ingestion Service Integration Flow", () => {
        let originalFetch: typeof global.fetch;

        beforeEach(() => {
            originalFetch = global.fetch;
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it("handles complete payload dispatch down to core ingestion handler structure", async () => {
            const mockPayload = {
                sensor_id: "sens-int-01",
                building_id: buildingId,
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