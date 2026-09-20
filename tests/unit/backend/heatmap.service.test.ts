import { getHeatmapDataService } from "../../../backend/core/src/services/heatmap.service";
import prisma from "../../../backend/core/src/lib/prisma";
import { redis } from "../../../backend/core/src/lib/redis";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {
        building: { findMany: jest.fn() },
        buildingAnalyticsWeekly: { findMany: jest.fn() },
        buildingAnalyticsMonthly: { findMany: jest.fn() }
    }
}));

jest.mock("../../../backend/core/src/lib/redis", () => {
    const pipelineMock = {
        set: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
    };
    return {
        redis: {
            mget: jest.fn(),
            pipeline: jest.fn(() => pipelineMock)
        }
    };
});

const mockIterateRows = jest.fn();

jest.mock("@influxdata/influxdb-client", () => {
    return {
        InfluxDB: jest.fn().mockImplementation(() => ({
            getQueryApi: jest.fn().mockReturnValue({
                iterateRows: (...args: any[]) => mockIterateRows(...args)
            })
        }))
    };
});

async function* createEmptyIterator() {}
async function* createDataIterator() {
    yield {
        values: ["something"],
        tableMeta: {
            toObject: () => ({
                building_id: "b1", _value: 75.5
            })
        }
    };
}
async function* createErrorIterator() {
    throw new Error("Influx connection error");
}

describe("Heatmap Service Unit Tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIterateRows.mockReturnValue(createEmptyIterator());
    });

    it("should_return_empty_point", async () => {
        (prisma.building.findMany as jest.Mock).mockResolvedValue([]);
        //act
        const out = await getHeatmapDataService("user-1", "live");
        //assert
        expect(out.points).toEqual([]);
        expect(prisma.building.findMany).toHaveBeenCalledTimes(1);
        expect(redis.mget).not.toHaveBeenCalled();
    });

    it("should_return_cached_data", async () => {
        (prisma.building.findMany as jest.Mock).mockResolvedValue([
            { building_id: "b1", latitude: 10, longitude: 20 },
            { building_id: "b2", latitude: 30, longitude: 40 }
        ]);
        (redis.mget as jest.Mock).mockResolvedValue(["100.5", "200.1"]);
        //act
        const out = await getHeatmapDataService("user-1", "-7d");
        //assert
        expect(out.points).toHaveLength(2);
        expect(out.points[0]).toEqual({ building_id: "b1", latitude: 10, longitude: 20, kwh_value: 100.5 });
        expect(out.points[1]).toEqual({ building_id: "b2", latitude: 30, longitude: 40, kwh_value: 200.1 });
        expect(redis.pipeline).not.toHaveBeenCalled();
    });

    it("should_query_forecast", async () => {
        (prisma.building.findMany as jest.Mock).mockResolvedValue([
            { building_id: "b1", latitude: 10, longitude: 20 }
        ]);
        (redis.mget as jest.Mock).mockResolvedValue([null]);
        (prisma.buildingAnalyticsWeekly.findMany as jest.Mock).mockResolvedValue([
            { building_id: "b1", forecast_avg_day: 50.0 }
        ]);
        //act
        const out = await getHeatmapDataService("user-1", "+7d");
        //assert
        expect(out.points).toHaveLength(1);
        expect(out.points[0].kwh_value).toBe(50);
        expect(prisma.buildingAnalyticsWeekly.findMany).toHaveBeenCalled();
        expect(redis.pipeline).toHaveBeenCalled();
    });

    it("should_query_live_telemetry", async () => {
        (prisma.building.findMany as jest.Mock).mockResolvedValue([
            { building_id: "b1", latitude: 10, longitude: 20 },
            { building_id: "b2", latitude: 30, longitude: 40 }
        ]);
        (redis.mget as jest.Mock).mockResolvedValue([null, null]);
        mockIterateRows.mockReturnValue(createDataIterator());
        //act
        const out = await getHeatmapDataService("user-1", "live");
        //assert
        expect(out.points).toHaveLength(2);
        expect(out.points[0].kwh_value).toBe(75.5);
        expect(out.points[1].kwh_value).toBeNull();
        expect(redis.pipeline).toHaveBeenCalled();
    });

    it("should__catch_errro", async () => {
        const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        (prisma.building.findMany as jest.Mock).mockResolvedValue([
            { building_id: "b1", latitude: 10, longitude: 20 }
        ]);
        (redis.mget as jest.Mock).mockResolvedValue([null]);
        mockIterateRows.mockReturnValue(createErrorIterator());
        //act
        const out = await getHeatmapDataService("user-1", "-7d");
        //assert
        expect(out.points).toHaveLength(1);
        expect(out.points[0].kwh_value).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("fetchTelemetry error for -7d"), expect.any(Error));
    });
});
