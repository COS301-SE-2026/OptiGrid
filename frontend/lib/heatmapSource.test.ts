import { timeframeById, type HeatmapBuilding } from "./heatmap";
import { fetchHeatmapSnapshot, forecastDailyValue, neighbouringTimeframes, runWithLimit } from "./heatmapSource";

const NOW = Date.parse("2026-09-18T10:00:00.000Z");
const DAY = 86400000;

const buildings: HeatmapBuilding[] = [
    { building_id: "b1", building_name: "Hatfield Park", latitude: -25.75, longitude: 28.23, square_footage: 2000 },
    { building_id: "b2", building_name: "Menlyn Hub", latitude: -25.78, longitude: 28.27, square_footage: 1000 },
    { building_id: "b3", building_name: "Unplaced Depot", latitude: null, longitude: null },
];

type Route = (url: string, init?: RequestInit) => { status: number; body: unknown } | undefined;

function mockFetch(route: Route) {
    const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
        const answer = route(url, init) ?? { status: 404, body: { message: "Not found" } };
        return {
            ok: answer.status >= 200 && answer.status < 300,
            status: answer.status,
            json: async () => answer.body,
        };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
}

describe("fetchHeatmapSnapshot", () => {
    it("uses the unified heatmap endpoint when it exists", async () => {
        const fetchMock = mockFetch((url) => (url.startsWith("/api/heatmap")
            ? { status: 200, body: { status: "success", data: { points: [{ building_id: "b1", value: 812.5, updated_at: "2026-09-18T09:00:00Z" }, { building_id: "b2", value: null }] } } }
            : undefined));

        const snapshot = await fetchHeatmapSnapshot({ timeframe: timeframeById("-30d"), buildings, now: NOW });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("/api/heatmap?timeframe=-30d", expect.objectContaining({ method: "GET" }));
        expect(snapshot.source).toBe("endpoint");
        expect(snapshot.points.map((point) => [point.buildingId, point.value, point.unit])).toEqual([["b1", 812.5, "kWh/day"], ["b2", null, "kWh/day"]]);
        expect(snapshot.points[0].updatedAt).toBe("2026-09-18T09:00:00Z");
        expect(snapshot.points[0].intensity).toBeCloseTo(0.40625, 5);
        expect(snapshot.missing).toEqual(["b2"]);
    });

    it("dates forecast points by their model latest run", async () => {
        mockFetch((url) => (url.startsWith("/api/heatmap")
            ? { status: 200, body: { data: { points: [{ building_id: "b1", value: 500, updated_at: "2026-09-18T09:00:00Z", model_updated_at: "2026-09-17T02:00:00Z" }] } } }
            : undefined));

        const future = await fetchHeatmapSnapshot({ timeframe: timeframeById("+7d"), buildings, now: NOW });
        const past = await fetchHeatmapSnapshot({ timeframe: timeframeById("-7d"), buildings, now: NOW });

        expect(future.points[0].updatedAt).toBe("2026-09-17T02:00:00Z");
        expect(past.points[0].updatedAt).toBe("2026-09-18T09:00:00Z");
    });

    it("reads live load from the telemetry feed when the endpoint is missing", async () => {
        mockFetch((url) => (url === "/api/telemetry/live"
            ? { status: 200, body: { status: "success", data: [{ building_id: "b1", current_kw: "42.5" }, { building_id: "b9", current_kw: 7 }] } }
            : undefined));

        const snapshot = await fetchHeatmapSnapshot({ timeframe: timeframeById("live"), buildings, now: NOW });

        expect(snapshot.source).toBe("composed");
        expect(snapshot.points.map((point) => [point.buildingId, point.value, point.unit])).toEqual([["b1", 42.5, "kW"], ["b2", null, "kW"]]);
        expect(snapshot.missing).toEqual(["b2"]);
    });

    it("builds past periods from each building consumption", async () => {
        const fetchMock = mockFetch((url) => {
            if (url.startsWith("/api/buildings/b1/energy-consumption?time_range=30d")) {
                return { status: 200, body: { data: { average_daily_kwh: 610, total_kwh: 18300 } } };
            }
            if (url.startsWith("/api/buildings/b2/energy-consumption?time_range=30d")) {
                return { status: 200, body: { data: { total_kwh: 9000 } } };
            }
            return undefined;
        });

        const snapshot = await fetchHeatmapSnapshot({ timeframe: timeframeById("-30d"), buildings, now: NOW });

        expect(snapshot.points.map((point) => point.value)).toEqual([610, 300]);
        expect(fetchMock.mock.calls.map(([url]) => url)).not.toContainEqual(expect.stringContaining("b3"));
    });

    it("asks for the weekly model for the nearest forecast", async () => {
        const fetchMock = mockFetch((url) => (url.startsWith("/api/analytics/forecast/")
            ? { status: 200, body: { forecast: [], summary: { avg_daily_kwh: 320 } } }
            : undefined));

        const snapshot = await fetchHeatmapSnapshot({ timeframe: timeframeById("+7d"), buildings: [buildings[0]], now: NOW });

        expect(fetchMock).toHaveBeenCalledWith("/api/heatmap?timeframe=%2B7d", expect.anything());
        expect(fetchMock).toHaveBeenCalledWith("/api/analytics/forecast/b1?horizon=weekly", expect.anything());
        expect(snapshot.points[0].value).toBe(320);
    });

    it("projects future periods using each building's forecast", async () => {
        const series = [
            { timestamp: new Date(NOW + 7 * DAY).toISOString(), yhat: 3000 },
            { timestamp: new Date(NOW + 28 * DAY).toISOString(), yhat: 4500 },
            { timestamp: new Date(NOW + 63 * DAY).toISOString(), yhat: 1500 },
        ];
        const fetchMock = mockFetch((url, init) => {
            if (url.startsWith("/api/analytics/forecast/b1") && init?.method === "POST") {
                return { status: 200, body: { forecast: series, summary: { avg_daily_kwh: 500 } } };
            }
            if (url.startsWith("/api/analytics/forecast/b2")) {
                return { status: 404, body: { message: "Forecast models are being generated" } };
            }
            return undefined;
        });

        const snapshot = await fetchHeatmapSnapshot({ timeframe: timeframeById("+30d"), buildings, now: NOW });

        expect(fetchMock).toHaveBeenCalledWith("/api/analytics/forecast/b1?horizon=monthly", expect.objectContaining({ method: "POST" }));
        expect(snapshot.points[0].value).toBeCloseTo(750, 5);
        expect(snapshot.points[1].value).toBeNull();
        expect(snapshot.missing).toEqual(["b2"]);
    });

    it("keeps working when the endpoint errors and when a building request fails", async () => {
        mockFetch((url) => {
            if (url.startsWith("/api/heatmap")) {
                return { status: 500, body: {} };
            }
            if (url.includes("/b1/")) {
                throw new TypeError("network down");
            }
            return { status: 200, body: { data: { average_daily_kwh: 90 } } };
        });

        const snapshot = await fetchHeatmapSnapshot({ timeframe: timeframeById("-7d"), buildings, now: NOW });

        expect(snapshot.points.map((point) => point.value)).toEqual([null, 90]);
    });
});

describe("forecastDailyValue", () => {
    const series = [
        { timestamp: "2026-09-20T00:00:00Z", yhat: 100 },
        { timestamp: "2026-09-27T00:00:00Z", yhat: 300 },
        { timestamp: "bad", yhat: 999 },
        { timestamp: "2026-10-04T00:00:00Z", yhat: "x" },
    ];

    it("holds the forecast shape to the model's daily average", () => {
        expect(forecastDailyValue(series, 400, Date.parse("2026-09-26T00:00:00Z"))).toBeCloseTo(600, 5);
        expect(forecastDailyValue(series, 400, Date.parse("2026-09-19T00:00:00Z"))).toBeCloseTo(200, 5);
    });

    it("refuses to stretch a forecast far beyond its last point", () => {
        const stale = [
            { timestamp: "2026-07-29T00:00:00Z", yhat: 40 },
            { timestamp: "2026-08-05T00:00:00Z", yhat: 41 },
        ];
        expect(forecastDailyValue(stale, 900, Date.parse("2026-10-18T00:00:00Z"))).toBeNull();
        expect(forecastDailyValue(stale, 900, Date.parse("2026-08-20T00:00:00Z"))).not.toBeNull();
    });

    it("falls back when either side is missing", () => {
        expect(forecastDailyValue([], 400, NOW)).toBe(400);
        expect(forecastDailyValue([], null, NOW)).toBeNull();
        expect(forecastDailyValue(series, null, Date.parse("2026-09-27T00:00:00Z"))).toBe(300);
    });
});

describe("runWithLimit", () => {
    it("never runs more than the limit at once and keeps results in order", async () => {
        let running = 0;
        let peak = 0;
        const results = await runWithLimit([1, 2, 3, 4, 5, 6, 7], 3, async (value) => {
            running += 1;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 5));
            running -= 1;
            return value * 10;
        });

        expect(results).toEqual([10, 20, 30, 40, 50, 60, 70]);
        expect(peak).toBe(3);
    });

    it("handles an empty list", async () => {
        await expect(runWithLimit([], 4, async () => 1)).resolves.toEqual([]);
    });
});

describe("neighbouringTimeframes", () => {
    it("returns the stops either side", () => {
        expect(neighbouringTimeframes("live")).toEqual(["-7d", "+7d"]);
        expect(neighbouringTimeframes("-90d")).toEqual(["-30d"]);
        expect(neighbouringTimeframes("+90d")).toEqual(["+30d"]);
    });
});