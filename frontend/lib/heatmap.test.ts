import {
    LIVE_INDEX,
    STALE_READING_MS,
    TIMEFRAMES,
    boundsOf,
    buildPoint,
    changeAgainst,
    colourStops,
    coordinatesOf,
    createPortfolioStore,
    describeTimeframe,
    formatChange,
    formatEnergy,
    formatIntensity,
    isPlaced,
    mixColours,
    parseColour,
    portfolioTotals,
    rankPoints,
    scaleOf,
    stressBand,
    stressColour,
    stressGradient,
    stressOf,
    timeframeAt,
    timeframeById,
    timeframeTarget,
    toFeatureCollection,
    type HeatmapBuilding,
    type HeatmapPoint,
} from "./heatmap";

const NOW = Date.parse("2026-09-18T10:00:00.000Z");
const DAY = 86400000;
const palette = { low: "#2F7D5D", moderate: "#B26B00", high: "#B23B3B" };

function building(id: string, extra: Partial<HeatmapBuilding> = {}): HeatmapBuilding {
    return {
        building_id: id,
        building_name: `Building ${id}`,
        building_type: "Commercial",
        latitude: -25.75,
        longitude: 28.19,
        square_footage: 1000,
        ...extra,
    };
}

function point(id: string, value: number | null, extra: Partial<HeatmapBuilding> = {}): HeatmapPoint {
    return buildPoint(building(id, extra), value, "kWh/day") as HeatmapPoint;
}

describe("timeframes", () => {
    it("runs from ninety days back through live to ninety days ahead", () => {
        expect(TIMEFRAMES.map((frame) => frame.id)).toEqual(["-90d", "-30d", "-7d", "live", "+7d", "+30d", "+90d"]);
        expect(TIMEFRAMES[LIVE_INDEX].kind).toBe("live");
        expect(TIMEFRAMES[LIVE_INDEX].unit).toBe("kW");
        expect(TIMEFRAMES.filter((frame) => frame.kind !== "live").every((frame) => frame.unit === "kWh/day")).toBe(true);
    });

    it("restricts and rounds lookups by position", () => {
        expect(timeframeAt(-4).id).toBe("-90d");
        expect(timeframeAt(2.6).id).toBe("live");
        expect(timeframeAt(40).id).toBe("+90d");
        expect(timeframeById("+30d").label).toBe("In 30 days");
        expect(timeframeById("nope" as never).id).toBe("live");
    });

    it("claculates the window each stop covers", () => {
        expect(timeframeTarget(timeframeById("-30d"), NOW)).toEqual({ start: NOW - 30 * DAY, end: NOW });
        expect(timeframeTarget(timeframeById("+7d"), NOW)).toEqual({ start: NOW, end: NOW + 7 * DAY });
        expect(timeframeTarget(timeframeById("live"), NOW)).toEqual({ start: NOW, end: NOW });
    });

    it("describes each stop in plain words", () => {
        expect(describeTimeframe(timeframeById("live"), NOW)).toBe("Streaming now");
        expect(describeTimeframe(timeframeById("-7d"), NOW)).toMatch(/^\d{1,2} \w+ to \d{1,2} \w+$|^\w+ \d{1,2} to \w+ \d{1,2}$/);
        expect(describeTimeframe(timeframeById("+30d"), NOW)).toMatch(/^Forecast for /);
    });
});

describe("placing buildings", () => {
    it("accepts real coordinates, including numeric strings", () => {
        expect(coordinatesOf(building("a", { latitude: "-25.7461", longitude: "28.1881" }))).toEqual({ latitude: -25.7461, longitude: 28.1881 });
        expect(isPlaced(building("a"))).toBe(true);
    });

    it("rejects missing, out of range and null island coordinates", () => {
        expect(coordinatesOf(building("a", { latitude: null }))).toBeNull();
        expect(coordinatesOf(building("a", { longitude: "" }))).toBeNull();
        expect(coordinatesOf(building("a", { latitude: 91 }))).toBeNull();
        expect(coordinatesOf(building("a", { longitude: -181 }))).toBeNull();
        expect(coordinatesOf(building("a", { latitude: 0, longitude: 0 }))).toBeNull();
        expect(buildPoint(building("a", { latitude: null }), 10, "kW")).toBeNull();
    });

    it("calculates intensity only when the floor area is known", () => {
        expect(point("a", 250, { square_footage: "500" }).intensity).toBe(0.5);
        expect(point("b", 250, { square_footage: null }).intensity).toBeNull();
        expect(point("c", 250, { square_footage: 0 }).areaM2).toBeNull();
        expect(point("d", null).intensity).toBeNull();
    });
});

describe("scaling and colour", () => {
    const points = [point("a", 100), point("b", 400), point("c", 800), point("d", 1000), point("e", null)];

    it("scales against the busy end of the portfolio without letting one outlier wash everything out", () => {
        const scale = scaleOf(points, "total");
        expect(scale.peak).toBe(1000);
        expect(scale.ceiling).toBe(800);
        expect(scale.total).toBe(2300);
        expect(scale.reporting).toBe(4);

        const outlier = [...Array.from({ length: 9 }, (_, index) => point(`p${index}`, 100)), point("huge", 5000)];
        expect(scaleOf(outlier, "total").ceiling).toBe(3000);
    });

    it("turns values into stress between zero and one", () => {
        const scale = scaleOf(points, "total");
        expect(stressOf(points[0], "total", scale)).toBeCloseTo(0.125, 5);
        expect(stressOf(points[1], "total", scale)).toBeCloseTo(0.5, 5);
        expect(stressOf(points[3], "total", scale)).toBe(1);
        expect(stressOf(points[4], "total", scale)).toBeNull();
        expect(stressBand(0.2)).toBe("low");
        expect(stressBand(0.6)).toBe("moderate");
        expect(stressBand(0.85)).toBe("high");
    });

    it("falls back to a safe scale when nothing is reporting", () => {
        expect(scaleOf([point("a", null)], "total")).toEqual({ ceiling: 1, peak: 0, total: 0, reporting: 0 });
    });

    it("builds a GeoJSON collection which the map can style directly", () => {
        const collection = toFeatureCollection(points, "total", scaleOf(points, "total"));

        expect(collection.type).toBe("FeatureCollection");
        expect(collection.features).toHaveLength(5);
        expect(collection.features[2]).toEqual({
            type: "Feature",
            id: 2,
            geometry: { type: "Point", coordinates: [28.19, -25.75] },
            properties: expect.objectContaining({ buildingId: "c", value: 800, stress: 1, weight: 1, reporting: 1 }),
        });
        expect(collection.features[4].properties).toEqual(expect.objectContaining({ value: 0, stress: 0, reporting: 0 }));
    });

    it("colours stress with the theme palette and exposes matching map stops", () => {
        expect(stressColour(0, palette)).toBe("#2f7d5d");
        expect(stressColour(0.7, palette)).toBe("#b26b00");
        expect(stressColour(0.95, palette)).toBe("#b23b3b");
        expect(stressColour(5, palette)).toBe("#b23b3b");
        expect(colourStops(palette)).toEqual([0, "#2F7D5D", 0.45, "#2F7D5D", 0.6, "#B26B00", 0.75, "#B26B00", 0.88, "#B23B3B", 1, "#B23B3B"]);
        expect(stressGradient(palette)).toBe("linear-gradient(90deg, #2F7D5D 0%, #2F7D5D 45%, #B26B00 60%, #B26B00 75%, #B23B3B 88%, #B23B3B 100%)");
    });

    it("reads hex and rgb tokens", () => {
        expect(parseColour("#fff")).toEqual([255, 255, 255]);
        expect(parseColour("rgb(95, 191, 147)")).toEqual([95, 191, 147]);
        expect(parseColour("oops")).toEqual([128, 128, 128]);
        expect(mixColours("#000000", "#ffffff", 0.5)).toBe("#808080");
    });
});

describe("ranking and totals", () => {
    it("ranks the busiest first and buildings without data last", () => {
        const ranked = rankPoints([point("b", 50), point("a", null), point("c", 900), point("d", 50)], "total");
        expect(ranked.map((item) => item.buildingId)).toEqual(["c", "b", "d", "a"]);
    });

    it("ranks by intensity when asked", () => {
        const small = point("small", 300, { square_footage: 100 });
        const large = point("large", 900, { square_footage: 3000 });
        expect(rankPoints([large, small], "intensity").map((item) => item.buildingId)).toEqual(["small", "large"]);
        expect(rankPoints([large, small], "total").map((item) => item.buildingId)).toEqual(["large", "small"]);
    });

    it("measures change against a baseline period", () => {
        const changes = changeAgainst([point("a", 100), point("b", 0), point("c", 50)], [point("a", 125), point("b", 10), point("d", 70), point("c", null)]);
        expect(changes.get("a")).toBeCloseTo(0.25, 5);
        expect(changes.has("b")).toBe(false);
        expect(changes.has("c")).toBe(false);
        expect(changes.has("d")).toBe(false);
    });

    
    it("totals the portfolio and names the hottest building", () => {
        const totals = portfolioTotals([point("a", 100), point("b", 300), point("c", null)], "total", "kWh/day");
        expect(totals).toEqual(expect.objectContaining({ total: 400, reporting: 2, placed: 3, unit: "kWh/day" }));
        expect(totals.hottest?.buildingId).toBe("b");
        expect(portfolioTotals([point("a", null)], "total", "kW").hottest).toBeNull();
    });

    it("frames the whole portfolio", () => {
        expect(boundsOf([])).toBeNull();
        expect(boundsOf([
            { latitude: -25.7, longitude: 28.2 },
            { latitude: -26.2, longitude: 28.0 },
            { latitude: -33.9, longitude: 18.4 },
        ])).toEqual([[18.4, -33.9], [28.2, -25.7]]);
    });
});

describe("formatting", () => {
    it("formats energy with sensible precision", () => {
        expect(formatEnergy(null, "kW")).toBe("-");
        expect(formatEnergy(12.34, "kW")).toBe("12.3 kW");
        expect(formatEnergy(1234.5, "kWh/day")).toBe("1,235 kWh/day");
        expect(formatIntensity(null)).toBe("-");
        expect(formatIntensity(0.5)).toBe("0.500 per m²");
        expect(formatIntensity(2.5)).toBe("2.50 per m²");
    });

    it("describes change in words", () => {
        expect(formatChange(undefined)).toBeNull();
        expect(formatChange(Number.NaN)).toBeNull();
        expect(formatChange(0.001)).toBe("Level with the last 7 days");
        expect(formatChange(0.18)).toBe("Up 18% on the last 7 days");
        expect(formatChange(-0.3, "last month")).toBe("Down 30% on last month");
    });
});

describe("createPortfolioStore", () => {
    it("adds up the latest reading from every sensor in a building", () => {
        const store = createPortfolioStore();
        store.ingest({ building_id: "b1", sensor_id: "s1", power_kw: 10 }, NOW);
        store.ingest({ building_id: "b1", sensor_id: "s2", power_kw: 5 }, NOW);
        store.ingest({ building_id: "b1", sensor_id: "s1", power_kw: 12 }, NOW + 1000);
        store.ingest({ building_id: "b2", sensor_id: "s3", power_kw: "7.5" }, NOW);

        const totals = store.totals(NOW + 2000);
        expect(totals.get("b1")).toBe(17);
        expect(totals.get("b2")).toBe(7.5);
        expect(store.lastReadingAt()).toBe(NOW + 1000);
    });

    it("ignores readings it cannot attribute", () => {
        const store = createPortfolioStore();
        expect(store.ingest({ building_id: "b1", power_kw: 10 })).toBe(false);
        expect(store.ingest({ sensor_id: "s1", power_kw: 10 })).toBe(false);
        expect(store.ingest({ building_id: "b1", sensor_id: "s1", power_kw: "lots" })).toBe(false);
        expect(store.totals(NOW).size).toBe(0);
    });

    it("prefers fresh sensor readings and falls back to polled totals when they go quiet", () => {
        const store = createPortfolioStore();
        store.replace("b1", 20, NOW);
        expect(store.totals(NOW).get("b1")).toBe(20);
        expect(store.lastReadingAt()).toBeNull();

        store.ingest({ building_id: "b1", sensor_id: "s1", power_kw: 3 }, NOW + 1000);
        store.replace("b1", 99, NOW + 2000);
        expect(store.totals(NOW + 2000).get("b1")).toBe(3);

        const later = NOW + 1000 + STALE_READING_MS + 1;
        store.replace("b1", 45, later);
        expect(store.totals(later).get("b1")).toBe(45);
    });

    it("drops sensors that have gone quiet", () => {
        const store = createPortfolioStore();
        store.ingest({ building_id: "b1", sensor_id: "s1", power_kw: 10 }, NOW);
        store.ingest({ building_id: "b1", sensor_id: "s2", power_kw: 4 }, NOW + STALE_READING_MS);

        expect(store.totals(NOW + STALE_READING_MS + 1).get("b1")).toBe(4);
        expect(store.totals(NOW + 3 * STALE_READING_MS).has("b1")).toBe(false);
    });


    it("forgets polled totals that are far out of date", () => {
        const store = createPortfolioStore();
        store.replace("b1", 20, NOW);
        expect(store.totals(NOW + 4 * STALE_READING_MS + 1).has("b1")).toBe(false);
    });
});