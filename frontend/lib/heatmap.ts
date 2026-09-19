export type TimeframeKind = "past" | "live" | "future";

export type TimeframeId = "-90d" | "-30d" | "-7d" | "live" | "+7d" | "+30d" | "+90d";

export type Timeframe = {
    id: TimeframeId;
    kind: TimeframeKind;
    days: number;
    label: string;
    short: string;
    unit: EnergyUnit;
};

export type EnergyUnit = "kWh/day" | "kW";

export const TIMEFRAMES: Timeframe[] = [
    { id: "-90d", kind: "past", days: 90, label: "Last 90 days", short: "90d", unit: "kWh/day" },
    { id: "-30d", kind: "past", days: 30, label: "Last 30 days", short: "30d", unit: "kWh/day" },
    { id: "-7d", kind: "past", days: 7, label: "Last 7 days", short: "7d", unit: "kWh/day" },
    { id: "live", kind: "live", days: 0, label: "Live", short: "Live", unit: "kW" },
    { id: "+7d", kind: "future", days: 7, label: "In 7 days", short: "+7d", unit: "kWh/day" },
    { id: "+30d", kind: "future", days: 30, label: "In 30 days", short: "+30d", unit: "kWh/day" },
    { id: "+90d", kind: "future", days: 90, label: "In 90 days", short: "+90d", unit: "kWh/day" },
];

export const LIVE_INDEX = TIMEFRAMES.findIndex((frame) => frame.id === "live");
export const STALE_READING_MS = 90000;

export function timeframeAt(index: number): Timeframe {
    return TIMEFRAMES[Math.min(TIMEFRAMES.length - 1, Math.max(0, Math.round(index)))];
}

export function timeframeById(id: TimeframeId): Timeframe {
    return TIMEFRAMES.find((frame) => frame.id === id) ?? TIMEFRAMES[LIVE_INDEX];
}

export function timeframeTarget(frame: Timeframe, now: number): { start: number; end: number } {
    const day = 86400000;
    if (frame.kind === "past") {
        return { start: now - frame.days * day, end: now };
    }
    if (frame.kind === "future") {
        return { start: now, end: now + frame.days * day };
    }
    return { start: now, end: now };
}

export function describeTimeframe(frame: Timeframe, now: number): string {
    const target = timeframeTarget(frame, now);
    const format = (value: number) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    if (frame.kind === "live") {
        return "Streaming now";
    }
    if (frame.kind === "past") {
        return `${format(target.start)} to ${format(target.end)}`;
    }
    return `Forecast for ${format(target.end)}`;
}

export type HeatmapBuilding = {
    building_id: string;
    building_name: string;
    building_type?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    square_footage?: number | string | null;
    physical_address?: string | null;
};

export type HeatmapPoint = {
    buildingId: string;
    name: string;
    type: string | null;
    latitude: number;
    longitude: number;
    areaM2: number | null;
    value: number | null;
    unit: EnergyUnit;
    intensity: number | null;
    updatedAt: string | null;
};

export type HeatmapMetric = "total" | "intensity";

export type HeatmapSnapshot = {
    timeframe: TimeframeId;
    generatedAt: number;
    points: HeatmapPoint[];
    missing: string[];
    source: "endpoint" | "composed";
};

export function toFiniteNumber(value: unknown): number | null {
    const parsedValue = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return typeof parsedValue === "number" && Number.isFinite(parsedValue) ? parsedValue : null;
}

export function coordinatesOf(building: HeatmapBuilding): { latitude: number; longitude: number } | null {
    const latitude = toFiniteNumber(building.latitude);
    const longitude = toFiniteNumber(building.longitude);
    if (latitude === null || longitude === null) {
        return null;
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return null;
    }
    if (latitude === 0 && longitude === 0) {
        return null;
    }
    return { latitude, longitude };
}

export function isPlaced(building: HeatmapBuilding): boolean {
    return coordinatesOf(building) !== null;
}

export function buildPoint(building: HeatmapBuilding, value: number | null, unit: EnergyUnit, updatedAt: string | null = null): HeatmapPoint | null {
    const coordinates = coordinatesOf(building);
    if (!coordinates) {
        return null;
    }
    const areaM2 = toFiniteNumber(building.square_footage);
    const usableArea = areaM2 !== null && areaM2 > 0 ? areaM2 : null;
    return {
        buildingId: building.building_id,
        name: building.building_name,
        type: building.building_type ?? null,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        areaM2: usableArea,
        value,
        unit,
        intensity: value === null || usableArea === null ? null : value / usableArea,
        updatedAt,
    };
}

export function metricValue(point: HeatmapPoint, metric: HeatmapMetric): number | null {
    return metric === "intensity" ? point.intensity : point.value;
}

export type HeatmapScale = {
    ceiling: number;
    peak: number;
    total: number;
    reporting: number;
};

export function scaleOf(points: HeatmapPoint[], metric: HeatmapMetric): HeatmapScale {
    const values = points.map((point) => metricValue(point, metric)).filter((value): value is number => value !== null && value > 0).sort((a, b) => a - b);

    if (values.length === 0) {
        return { ceiling: 1, peak: 0, total: 0, reporting: 0 };
    }

    const peak = values[values.length - 1];
    const upper = values[Math.floor((values.length - 1) * 0.9)];
    return {
        ceiling: Math.max(upper, peak * 0.6, 0.0001),
        peak,
        total: values.reduce((sum, value) => sum + value, 0),
        reporting: values.length,
    };
}

export function stressOf(point: HeatmapPoint, metric: HeatmapMetric, scale: HeatmapScale): number | null {
    const value = metricValue(point, metric);
    if (value === null) {
        return null;
    }
    return Math.min(1, Math.max(0, value / scale.ceiling));
}

export type HeatmapFeature = {
    type: "Feature";
    id: number;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: {
        buildingId: string;
        name: string;
        type: string;
        value: number;
        stress: number;
        weight: number;
        reporting: number;
    };
};

export type HeatmapFeatureCollection = {
    type: "FeatureCollection";
    features: HeatmapFeature[];
};

export function toFeatureCollection(points: HeatmapPoint[], metric: HeatmapMetric, scale: HeatmapScale): HeatmapFeatureCollection {
    return {
        type: "FeatureCollection",
        features: points.map((point, index) => {
            const stress = stressOf(point, metric, scale);
            return {
                type: "Feature" as const,
                id: index,
                geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] as [number, number] },
                properties: {
                    buildingId: point.buildingId,
                    name: point.name,
                    type: point.type ?? "",
                    value: metricValue(point, metric) ?? 0,
                    stress: stress ?? 0,
                    weight: stress ?? 0,
                    reporting: stress === null ? 0 : 1,
                },
            };
        }),
    };
}

export type Bounds = [[number, number], [number, number]];

export function boundsOf(points: Array<{ latitude: number; longitude: number }>): Bounds | null {
    if (points.length === 0) {
        return null;
    }
    let west = points[0].longitude;
    let east = points[0].longitude;
    let south = points[0].latitude;
    let north = points[0].latitude;
    for (const point of points) {
        west = Math.min(west, point.longitude);
        east = Math.max(east, point.longitude);
        south = Math.min(south, point.latitude);
        north = Math.max(north, point.latitude);
    }
    return [[west, south], [east, north]];
}

export function rankPoints(points: HeatmapPoint[], metric: HeatmapMetric): HeatmapPoint[] {
    return [...points].sort((a, b) => {
        const left = metricValue(a, metric);
        const right = metricValue(b, metric);
        if (left === null && right === null) {
            return a.name.localeCompare(b.name);
        }
        if (left === null) {
            return 1;
        }
        if (right === null) {
            return -1;
        }
        return right - left || a.name.localeCompare(b.name);
    });
}

export type PortfolioTotals = {
    total: number;
    reporting: number;
    placed: number;
    hottest: HeatmapPoint | null;
    unit: EnergyUnit;
};

export function portfolioTotals(points: HeatmapPoint[], metric: HeatmapMetric, unit: EnergyUnit): PortfolioTotals {
    const pointsRanked = rankPoints(points, metric);
    const reporting = points.filter((point) => metricValue(point, metric) !== null);
    return {
        total: reporting.reduce((sum, point) => sum + (point.value ?? 0), 0),
        reporting: reporting.length,
        placed: points.length,
        hottest: reporting.length > 0 ? pointsRanked[0] : null,
        unit,
    };
}

export function changeAgainst(baseline: HeatmapPoint[], points: HeatmapPoint[]): Map<string, number> {
    const before = new Map(baseline.map((point) => [point.buildingId, point.value]));
    const changes = new Map<string, number>();
    for (const point of points) {
        const previous = before.get(point.buildingId);
        if (previous !== undefined && previous !== null && previous > 0 && point.value !== null) {
            changes.set(point.buildingId, point.value / previous - 1);
        }
    }
    return changes;
}

export type StressBand = "low" | "moderate" | "high";

export type HeatPalette = {
    low: string;
    moderate: string;
    high: string;
};

const BAND_EDGES: Array<[number, StressBand]> = [
    [0, "low"],
    [0.45, "low"],
    [0.6, "moderate"],
    [0.75, "moderate"],
    [0.88, "high"],
    [1, "high"],
];

export function stressBand(stress: number): StressBand {
    if (stress >= 0.8) {
        return "high";
    }
    return stress >= 0.55 ? "moderate" : "low";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parseColour(value: string): [number, number, number] {
    const text = value.trim();
    const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(text);
    if (rgb) {
        return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    }
    const hex = text.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((part) => part + part).join("") : hex.slice(0, 6);
    const parsed = Number.parseInt(full, 16);
    if (full.length !== 6 || Number.isNaN(parsed)) {
        return [128, 128, 128];
    }
    return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

function toHex(channels: number[]): string {
    return `#${channels.map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

export function mixColours(from: string, to: string, amount: number): string {
    const start = parseColour(from);
    const end = parseColour(to);
    const ratio = clamp(amount, 0, 1);
    return toHex(start.map((channel, index) => channel + (end[index] - channel) * ratio));
}

export function stressColour(stress: number, palette: HeatPalette): string {
    const value = clamp(stress, 0, 1);
    for (let index = 1; index < BAND_EDGES.length; index += 1) {
        const [edge, band] = BAND_EDGES[index];
        if (value <= edge) {
            const [previousEdge, previousBand] = BAND_EDGES[index - 1];
            const span = edge - previousEdge;
            return mixColours(palette[previousBand], palette[band], span === 0 ? 1 : (value - previousEdge) / span);
        }
    }
    return palette.high;
}

export function colourStops(palette: HeatPalette): Array<number | string> {
    return BAND_EDGES.flatMap(([edge, band]) => [edge, palette[band]]);
}

export function stressGradient(palette: HeatPalette): string {
    const stops = BAND_EDGES.map(([edge, band]) => `${palette[band]} ${Math.round(edge * 100)}%`);
    return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function formatEnergy(value: number | null, unit: EnergyUnit): string {
    if (value === null) {
        return "-";
    }
    const digits = Math.abs(value) >= 100 ? 0 : 1;
    const amount = value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return `${amount} ${unit}`;
}

export function formatIntensity(value: number | null): string {
    if (value === null) {
        return "-";
    }
    const digits = value < 1 ? 3 : 2;
    return `${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} per m²`;
}

export const BASELINE_TIMEFRAME: TimeframeId = "-7d";

export function formatChange(change: number | undefined, reference = "the last 7 days"): string | null {
    if (change === undefined || !Number.isFinite(change)) {
        return null;
    }
    const percent = Math.round(change * 100);
    if (percent === 0) {
        return `Level with ${reference}`;
    }
    return `${percent > 0 ? "Up" : "Down"} ${Math.abs(percent)}% on ${reference}`;
}

export type LiveReading = {
    powerKw: number;
    receivedAt: number;
};

export type PortfolioStore = {
    ingest: (reading: { building_id?: unknown; sensor_id?: unknown; power_kw?: unknown }, receivedAt?: number) => boolean;
    replace: (buildingId: string, powerKw: number, receivedAt?: number) => void;
    totals: (now: number) => Map<string, number>;
    lastReadingAt: () => number | null;
};

export function createPortfolioStore(): PortfolioStore {
    const sensors = new Map<string, Map<string, LiveReading>>();
    const direct = new Map<string, LiveReading>();
    let lastReadingAt: number | null = null;

    const ingest = (reading: { building_id?: unknown; sensor_id?: unknown; power_kw?: unknown }, receivedAt = Date.now()) => {
        const buildingId = typeof reading?.building_id === "string" ? reading.building_id : null;
        const sensorId = typeof reading?.sensor_id === "string" ? reading.sensor_id : null;
        const powerKw = toFiniteNumber(reading?.power_kw);
        if (!buildingId || !sensorId || powerKw === null) {
            return false;
        }
        const building = sensors.get(buildingId) ?? new Map<string, LiveReading>();
        building.set(sensorId, { powerKw: Math.max(0, powerKw), receivedAt });
        sensors.set(buildingId, building);
        lastReadingAt = Math.max(lastReadingAt ?? 0, receivedAt);
        return true;
    };

    const replace = (buildingId: string, powerKw: number, receivedAt = Date.now()) => {
        direct.set(buildingId, { powerKw: Math.max(0, powerKw), receivedAt });
    };

    const totals = (now: number) => {
        const result = new Map<string, number>();
        for (const [buildingId, building] of sensors) {
            let sum = 0;
            let fresh = false;
            for (const reading of building.values()) {
                if (now - reading.receivedAt <= STALE_READING_MS) {
                    sum += reading.powerKw;
                    fresh = true;
                }
            }
            if (fresh) {
                result.set(buildingId, sum);
            }
        }
        for (const [buildingId, reading] of direct) {
            if (!result.has(buildingId) && now - reading.receivedAt <= STALE_READING_MS * 4) {
                result.set(buildingId, reading.powerKw);
            }
        }
        return result;
    };

    return { ingest, replace, totals, lastReadingAt: () => lastReadingAt };
}