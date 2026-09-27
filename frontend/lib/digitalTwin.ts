import type { TelemetryData } from "./useTelemetryStream";

export type TwinSensorStatus = "Active" | "Offline" | "Maintenance";

export type TwinSensor = {
    sensor_id: string;
    mac_address?: string | null;
    sensor_type?: string | null;
    location_zone?: string | null;
    status?: TwinSensorStatus | null;
};

export type TwinBuilding = {
    building_id: string;
    building_name?: string | null;
    building_type?: string | null;
    square_footage?: number | string | null;
    nominal_voltage?: number | null;
    max_current_threshold?: number | null;
    max_occupancy?: number | string | null;
    floors_above_ground?: number | string | null;
    solar_capacity_kw?: number | string | null;
};

export type Vec3 = [number, number, number];
export type PlacementKind = "incomer" | "floor" | "roof";

export type SensorPlacement = {
    sensor: TwinSensor;
    kind: PlacementKind;
    floor: number;
    zone: string;
    position: Vec3;
};

export type FlowPath = {
    driver: string | null;
    points: Vec3[];
};

export type TwinLayout = {
    floors: number;
    floorHeight: number;
    width: number;
    depth: number;
    height: number;
    incomer: Vec3;
    gridSource: Vec3;
    placements: SensorPlacement[];
    flows: FlowPath[];
    radius: number;
    massing: TwinMassing;
};

export type BuildingForm = "tower" | "podium" | "slab" | "shed" | "mall" | "wings" | "frame";

type BuildingProfile = {
    footprint: number;
    minFloors: number;
    maxFloors: number;
    floorHeight: number;
    aspect: number;
    form: BuildingForm;
};

const DEFAULT_PROFILE: BuildingProfile = { footprint: 700, minFloors: 2, maxFloors: 8, floorHeight: 1.3, aspect: 1.1, form: "tower" };

const BUILDING_PROFILES: Record<string, BuildingProfile> = {
    Residential: { footprint: 320, minFloors: 2, maxFloors: 12, floorHeight: 1.15, aspect: 0.8, form: "slab" },
    Commercial: { footprint: 650, minFloors: 2, maxFloors: 12, floorHeight: 1.3, aspect: 1, form: "podium" },
    Industrial: { footprint: 4000, minFloors: 1, maxFloors: 2, floorHeight: 2.6, aspect: 1.6, form: "shed" },
    Healthcare: { footprint: 1100, minFloors: 2, maxFloors: 8, floorHeight: 1.4, aspect: 1.35, form: "wings" },
    ShoppingCentre: { footprint: 3200, minFloors: 1, maxFloors: 3, floorHeight: 1.8, aspect: 1.7, form: "mall" },
    Mixed_Use: { footprint: 550, minFloors: 3, maxFloors: 12, floorHeight: 1.25, aspect: 1, form: "podium" },
    Construction: { footprint: 600, minFloors: 2, maxFloors: 8, floorHeight: 1.3, aspect: 1, form: "frame" },
};

export type RoofStyle = "flat" | "pitched" | "sawtooth" | "vaulted";
export type FacadeStyle = "glass" | "punched" | "panel" | "frame";

export type MassingBlock = {
    id: string;
    centreX: number;
    centreZ: number;
    width: number;
    depth: number;
    baseFloor: number;
    floors: number;
};

export type Footprint = {
    centreX: number;
    centreZ: number;
    width: number;
    depth: number;
};

export type EntranceStyle = "canopy" | "shopfront" | "dock" | "none";

export type TwinDetail = {
    entrance: EntranceStyle;
    windows: boolean;
    balconies: boolean;
    fins: boolean;
    parapet: boolean;
    docks: number;
    plantUnits: number;
    tank: boolean;
    liftOverrun: boolean;
    windowSpacing: number;
};

export type TwinMassing = {
    form: BuildingForm;
    blocks: MassingBlock[];
    roof: RoofStyle;
    facade: FacadeStyle;
    roofRise: number;
    bays: number;
    plant: boolean;
    detail: TwinDetail;
};

const NO_DETAIL: TwinDetail = {
    entrance: "none",
    windows: false,
    balconies: false,
    fins: false,
    parapet: false,
    docks: 0,
    plantUnits: 0,
    tank: false,
    liftOverrun: false,
    windowSpacing: 1.35,
};

function detailFor(form: BuildingForm, floors: number, windowSpacing = 1.35): TwinDetail {
    switch (form) {
        case "podium":
            return { ...NO_DETAIL, windowSpacing, entrance: "canopy", fins: true, parapet: true, plantUnits: 3, tank: true, liftOverrun: true };
        case "slab":
            return { ...NO_DETAIL, windowSpacing, entrance: "canopy", windows: true, balconies: floors >= 3, parapet: floors > 5, plantUnits: 1, tank: true };
        case "shed":
            return { ...NO_DETAIL, windowSpacing, entrance: "dock", docks: clamp(Math.round(floors * 2) + 2, 2, 5), plantUnits: 2 };
        case "mall":
            return { ...NO_DETAIL, windowSpacing, entrance: "shopfront", parapet: true, plantUnits: 4, tank: true };
        case "wings":
            return { ...NO_DETAIL, windowSpacing, entrance: "canopy", windows: true, parapet: true, plantUnits: 2, tank: true, liftOverrun: true };
        case "frame":
            return NO_DETAIL;
        default:
            return { ...NO_DETAIL, windowSpacing, entrance: "canopy", fins: true, parapet: true, plantUnits: 2, liftOverrun: true };
    }
}

function wholeBlock(width: number, depth: number, floors: number): MassingBlock {
    return { id: "main", centreX: 0, centreZ: 0, width: round3(width), depth: round3(depth), baseFloor: 0, floors };
}

export function buildMassing(form: BuildingForm, width: number, depth: number, floors: number, floorHeight: number, windowSpacing = 1.35): TwinMassing {
    if (form === "podium" && floors >= 4) {
        const podiumFloors = clamp(Math.floor(floors / 3), 1, 2);
        return {
            form,
            blocks: [
                { id: "podium", centreX: 0, centreZ: 0, width: round3(width), depth: round3(depth), baseFloor: 0, floors: podiumFloors },
                {
                    id: "tower",
                    centreX: 0,
                    centreZ: round3(-depth * 0.05),
                    width: round3(width * 0.66),
                    depth: round3(depth * 0.66),
                    baseFloor: podiumFloors,
                    floors: floors - podiumFloors,
                },
            ],
            roof: "flat",
            facade: "glass",
            roofRise: 0,
            bays: 0,
            plant: true,
            detail: detailFor("podium", floors, windowSpacing),
        };
    }

    if (form === "wings" && floors >= 2) {
        const wingFloors = Math.max(1, floors - 1);
        const wingWidth = round3(width * 0.34);
        const offset = round3(width * 0.333);
        return {
            form,
            blocks: [
                { id: "core", centreX: 0, centreZ: 0, width: round3(width * 0.36), depth: round3(depth), baseFloor: 0, floors },
                { id: "wing-west", centreX: -offset, centreZ: 0, width: wingWidth, depth: round3(depth * 0.6), baseFloor: 0, floors: wingFloors },
                { id: "wing-east", centreX: offset, centreZ: 0, width: wingWidth, depth: round3(depth * 0.6), baseFloor: 0, floors: wingFloors },
            ],
            roof: "flat",
            facade: "punched",
            roofRise: 0,
            bays: 0,
            plant: true,
            detail: detailFor("wings", floors, windowSpacing),
        };
    }

    if (form === "shed") {
        return {
            form,
            blocks: [wholeBlock(width, depth, floors)],
            roof: "sawtooth",
            facade: "panel",
            roofRise: round3(Math.min(1.1, floorHeight * 0.42)),
            bays: clamp(Math.round(width / 2.6), 3, 8),
            plant: false,
            detail: detailFor("shed", floors, windowSpacing),
        };
    }

    if (form === "mall") {
        return {
            form,
            blocks: [wholeBlock(width, depth, floors)],
            roof: "vaulted",
            facade: "panel",
            roofRise: round3(Math.min(1.6, depth * 0.16)),
            bays: 0,
            plant: true,
            detail: detailFor("mall", floors, windowSpacing),
        };
    }

    if (form === "slab") {
        const pitched = floors <= 5;
        return {
            form,
            blocks: [wholeBlock(width, depth, floors)],
            roof: pitched ? "pitched" : "flat",
            facade: "punched",
            roofRise: pitched ? round3(floorHeight * 0.85) : 0,
            bays: 0,
            plant: !pitched,
            detail: detailFor("slab", floors, windowSpacing),
        };
    }

    if (form === "frame") {
        return {
            form,
            blocks: [wholeBlock(width, depth, floors)],
            roof: "flat",
            facade: "frame",
            roofRise: 0,
            bays: 0,
            plant: false,
            detail: NO_DETAIL,
        };
    }

    return {
        form: form === "podium" || form === "wings" ? "tower" : form,
        blocks: [wholeBlock(width, depth, floors)],
        roof: "flat",
        facade: "glass",
        roofRise: 0,
        bays: 0,
        plant: true,
        detail: detailFor("tower", floors, windowSpacing),
    };
}

export function footprintAtFloor(massing: TwinMassing, floor: number): Footprint {
    const covering = massing.blocks.filter((block) => floor >= block.baseFloor && floor < block.baseFloor + block.floors);
    const chosen = covering.length > 0 ? covering : [massing.blocks[massing.blocks.length - 1]];
    let west = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    for (const block of chosen) {
        west = Math.min(west, block.centreX - block.width / 2);
        east = Math.max(east, block.centreX + block.width / 2);
        south = Math.min(south, block.centreZ - block.depth / 2);
        north = Math.max(north, block.centreZ + block.depth / 2);
    }
    return {
        centreX: round3((west + east) / 2),
        centreZ: round3((south + north) / 2),
        width: round3(east - west),
        depth: round3(north - south),
    };
}

const INCOMER_PATTERN = /\b(incomer|intake|mains|grid|utility)\b|^main(\s+(board|feed|meter|supply|switchboard|panel|db))?$/i;
const GROUND_PATTERN = /\b(ground|lobby|reception|basement|parking)\b/i;
const FLOOR_PATTERN = /\b(?:floor|level|lvl|storey)\s*(\d{1,2})\b/i;
const ROOF_PATTERN = /\b(roof|rooftop|chiller|solar|pv)\b/i;
const FRONT_ANGLE = Math.atan2(1.18, 1);
const SHORT_LEVEL_PATTERN = /^l(\d{1,2})\b/i;
const UNZONED = "Unzoned";

export const DEFAULT_LIMIT_AMPS = 60;
export const DEFAULT_VOLTAGE = 230;
export const STALE_AFTER_MS = 15000;
export const BASELINE_WARMUP = 5;
export const ELEVATED_STRESS = 0.6;
export const CRITICAL_STRESS = 0.85;

const BASELINE_WEIGHT = 0.02;
const BASELINE_PULL = 1.5;

const round3 = (value: number) => Math.round(value * 1000) / 1000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function positiveNumber(value: unknown): number | null {
    const parsedValue = finiteNumber(value);
    return parsedValue !== null && parsedValue > 0 ? parsedValue : null;
}

function finiteNumber(value: unknown): number | null {
    const parsedValue = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return typeof parsedValue === "number" && Number.isFinite(parsedValue) ? parsedValue : null;
}

function compareText(left: string, right: string): number {
    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function zoneOf(sensor: TwinSensor): string {
    return sensor.location_zone?.trim() || UNZONED;
}

export function sensorLabel(sensor: TwinSensor): string {
    return sensor.location_zone?.trim() || sensor.sensor_type?.trim() || "Unzoned sensor";
}

type ZoneClass =
    | { kind: "incomer" }
    | { kind: "roof" }
    | { kind: "floor"; floor: number }
    | { kind: "zone" };

export function classifyZone(zone: string): ZoneClass {
    if (INCOMER_PATTERN.test(zone)) {
        return { kind: "incomer" };
    }
    if (ROOF_PATTERN.test(zone)) {
        return { kind: "roof" };
    }
    const floorMatch = FLOOR_PATTERN.exec(zone) ?? SHORT_LEVEL_PATTERN.exec(zone);
    if (floorMatch) {
        return { kind: "floor", floor: Number(floorMatch[1]) };
    }
    if (GROUND_PATTERN.test(zone)) {
        return { kind: "floor", floor: 0 };
    }
    return { kind: "zone" };
}

type Entry = {
    sensor: TwinSensor;
    zone: string;
    kind: PlacementKind;
    floor: number;
};

function spreadZones(zones: string[], floors: number): Map<string, number> {
    const assigned = new Map<string, number>();
    zones.forEach((zone, index) => {
        const floor = zones.length === 1 ? Math.floor((floors - 1) / 2) : Math.round((index * (floors - 1)) / (zones.length - 1));
        assigned.set(zone, floor);
    });
    return assigned;
}

function ringIn(footprint: Footprint, index: number, count: number, spin: number, y: number, spread: number): Vec3 {
    const angle = FRONT_ANGLE + spin + (count > 1 ? (index * Math.PI * 2) / count : 0);
    const inner = count > 8 && index % 2 === 1;
    const scale = inner ? spread * 0.6 : spread;
    return [
        round3(footprint.centreX + Math.cos(angle) * footprint.width * scale),
        round3(y),
        round3(footprint.centreZ + Math.sin(angle) * footprint.depth * scale),
    ];
}

export const KW_PER_PANEL = 0.45;
export const MAX_PANELS = 40;

export function solarPanelCount(building: TwinBuilding): number {
    const capacity = positiveNumber(building.solar_capacity_kw);
    if (capacity === null) {
        return 0;
    }
    return clamp(Math.round(capacity / KW_PER_PANEL), 1, MAX_PANELS);
}

//a densely occupied floor plate carries more  narrower openings than a sparse one
export function windowSpacingFor(building: TwinBuilding, floorArea: number): number {
    const occupancy = positiveNumber(building.max_occupancy);
    if (occupancy === null || floorArea <= 0) {
        return 1.35;
    }
    const perHundred = (occupancy / floorArea) * 100;
    return round3(clamp(1.75 - perHundred * 0.12, 0.95, 1.75));
}

export function buildingTypeLabel(type?: string | null): string {
    const raw = type?.trim();
    if (!raw) {
        return "Building";
    }
    const spaced = raw.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    const lowered = spaced.toLowerCase();
    return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

export function describeBuilding(building: TwinBuilding, layout: TwinLayout): string[] {
    const facts = [buildingTypeLabel(building.building_type)];
    facts.push(layout.floors === 1 ? "1 floor" : `${layout.floors} floors`);
    const area = positiveNumber(building.square_footage);
    if (area !== null) {
        facts.push(`${Math.round(area).toLocaleString()} m\u00B2`);
    }
    return facts;
}

export function buildTwinLayout(building: TwinBuilding, sensors: TwinSensor[]): TwinLayout {
    const profile = BUILDING_PROFILES[building.building_type ?? ""] ?? DEFAULT_PROFILE;
    const area = positiveNumber(building.square_footage);
    const sorted = [...sensors].sort((a, b) => compareText(zoneOf(a), zoneOf(b)) || a.sensor_id.localeCompare(b.sensor_id));
    const classes = sorted.map((sensor) => ({ sensor, zone: zoneOf(sensor), zoneClass: classifyZone(zoneOf(sensor)) }));
    const requestedTop = classes.reduce((top, item) => (item.zoneClass.kind === "floor" ? Math.max(top, item.zoneClass.floor) : top), 0);
    const stated = positiveNumber(building.floors_above_ground);
    const areaFloors = area === null ? profile.minFloors + 1 : Math.ceil(area / profile.footprint);
    const floors = stated === null
        ? clamp(Math.max(areaFloors, requestedTop + 1), profile.minFloors, profile.maxFloors)
        : clamp(Math.max(Math.round(stated), requestedTop + 1), 1, 60);
    const floorArea = area === null ? profile.footprint : area / floors;
    const base = clamp(8 + Math.sqrt(floorArea) / 12, 8, 14);
    const width = round3(base * Math.sqrt(profile.aspect));
    const depth = round3(base / Math.sqrt(profile.aspect));
    const floorHeight = profile.floorHeight;
    const height = round3(floors * floorHeight);
    const massing = buildMassing(profile.form, width, depth, floors, floorHeight, windowSpacingFor(building, floorArea));
    const topFootprint = footprintAtFloor(massing, floors - 1);
    const genericZones = [...new Set(classes.filter((item) => item.zoneClass.kind === "zone").map((item) => item.zone))];
    const zoneFloors = spreadZones(genericZones, floors);

    const entries: Entry[] = classes.map(({ sensor, zone, zoneClass }) => {
        switch (zoneClass.kind) {
            case "incomer":
                return { sensor, zone, kind: "incomer", floor: 0 };
            case "roof":
                return { sensor, zone, kind: "roof", floor: floors };
            case "floor":
                return { sensor, zone, kind: "floor", floor: clamp(zoneClass.floor, 0, floors - 1) };
            default:
                return { sensor, zone, kind: "floor", floor: zoneFloors.get(zone) ?? 0 };
        }
    });

    const incomer: Vec3 = [round3(width / 2 + 3), 0, round3(depth * 0.18)];
    const gridSource: Vec3 = [round3(incomer[0] + 6), 2.4, incomer[2]];
    const buildingEntry: Vec3 = [round3(width / 2), 0.35, incomer[2]];
    const riserBase: Vec3 = [0, 0.35, 0];
    const groups = new Map<string, Entry[]>();

    for (const entry of entries) {
        const key = `${entry.kind}:${entry.floor}`;
        groups.set(key, [...(groups.get(key) ?? []), entry]);
    }

    const placements: SensorPlacement[] = [];

    for (const group of groups.values()) {
        group.forEach((entry, index) => {
            let position: Vec3;
            if (entry.kind === "incomer") {
                position = [incomer[0], 1.35, round3(incomer[2] + (index - (group.length - 1) / 2) * 0.9)];
            } 
            else if (entry.kind === "roof") {
                position = ringIn(topFootprint, index, group.length, 0.4, height + massing.roofRise + 0.55, 0.22);
            } 
            else {
                const y = entry.floor * floorHeight + floorHeight * 0.42;
                const spin = group.length > 1 ? entry.floor * 0.7 : 0;
                position = ringIn(footprintAtFloor(massing, entry.floor), index, group.length, spin, y, 0.44);
            }
            placements.push({ sensor: entry.sensor, kind: entry.kind, floor: entry.floor, zone: entry.zone, position });
        });
    }

    const flows: FlowPath[] = [
        { driver: null, points: [[incomer[0], 0.35, incomer[2]], buildingEntry, riserBase] },
    ];
    if (!placements.some((placement) => placement.kind === "incomer")) {
        flows.push({ driver: null, points: [gridSource, [incomer[0], 1.9, incomer[2]], [incomer[0], 1.1, incomer[2]]] });
    }
    for (const placement of placements) {
        const [x, y, z] = placement.position;
        const points: Vec3[] = placement.kind === "incomer" ? [gridSource, [x, 1.9, z], placement.position] : [riserBase, [0, round3(y), 0], placement.position];
        flows.push({ driver: placement.sensor.sensor_id, points });
    }
    const crown = round3(height + massing.roofRise);
    const radius = round3(Math.hypot(Math.max(width / 2 + 3.5, depth / 2), crown / 2) + 1);
    return { floors, floorHeight, width, depth, height, incomer, gridSource, placements, flows, radius, massing };
}

export type CameraFraming = {
    position: Vec3;
    target: Vec3;
    minDistance: number;
    maxDistance: number;
};

export function cameraFraming(layout: TwinLayout, fovDegrees = 40): CameraFraming {
    const distance = (layout.radius / Math.sin((fovDegrees * Math.PI) / 360)) * 1.02;
    const direction: Vec3 = [1, 0.72, 1.18];
    const length = Math.hypot(...direction);
    const target: Vec3 = [1.2, round3(layout.height * 0.42), 0];
    return {
        position: [
            round3(target[0] + (direction[0] / length) * distance),
            round3(target[1] + (direction[1] / length) * distance),
            round3(target[2] + (direction[2] / length) * distance),
        ],
        target,
        minDistance: round3(layout.radius * 0.6),
        maxDistance: round3(distance * 2.2),
    };
}

export type MeasuredPath = {
    points: Vec3[];
    cumulative: number[];
    length: number;
};

export function measurePath(points: Vec3[]): MeasuredPath {
    const cumulative = [0];
    for (let index = 1; index < points.length; index += 1) {
        const [ax, ay, az] = points[index - 1];
        const [bx, by, bz] = points[index];
        cumulative.push(cumulative[index - 1] + Math.hypot(bx - ax, by - ay, bz - az));
    }
    return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

export function writePointAlongPath(path: MeasuredPath, progress: number, target: Float32Array, offset: number): void {
    const { points, cumulative, length } = path;
    const distance = clamp(progress, 0, 1) * length;
    let segment = 1;
    while (segment < points.length - 1 && cumulative[segment] < distance) {
        segment += 1;
    }
    const start = points[segment - 1];
    const end = points[segment] ?? start;
    const span = cumulative[segment] - cumulative[segment - 1];
    const t = span > 0 ? (distance - cumulative[segment - 1]) / span : 0;
    target[offset] = start[0] + (end[0] - start[0]) * t;
    target[offset + 1] = start[1] + (end[1] - start[1]) * t;
    target[offset + 2] = start[2] + (end[2] - start[2]) * t;
}

export type IncomingReading = Partial<Record<keyof TelemetryData, unknown>> & {
    baseline_kw?: unknown;
    recent?: Array<{ power_kw?: unknown; timestamp?: unknown }> | null;
};

export type LiveReading = {
    powerKw: number;
    currentA: number | null;
    voltageV: number | null;
    readingAt: number;
    lastSeenAt: number;
    baseline: number | null;
    deviation: number | null;
    samples: number;
    history: number[];
};

export type IngestOptions = {
    receivedAt?: number;
    source?: "stream" | "snapshot";
};

export type ReadingStore = {
    ingest: (reading: IncomingReading, options?: IngestOptions) => boolean;
    get: (sensorId: string) => LiveReading | undefined;
    version: () => number;
    lastStreamAt: () => number | null;
    subscribe: (listener: () => void) => () => void;
};

function parseTime(value: unknown): number | null {
    if (typeof value !== "string" || value === "") {
        return null;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function createReadingStore(buildingId: string, historyLength = 40): ReadingStore {
    const readings = new Map<string, LiveReading>();
    const listeners = new Set<() => void>();
    let version = 0;
    let streamAt: number | null = null;

    const record = (
        sensorId: string,
        powerKw: number,
        reading: IncomingReading,
        readingAt: number,
        lastSeenAt: number,
        seed: number | null = null,
    ) => {
        const previous = readings.get(sensorId);
        if (previous && readingAt <= previous.readingAt) {
            return false;
        }
        const baseline = seed ?? previous?.baseline ?? null;
        const samples = seed === null ? previous?.samples ?? 0 : Math.max(previous?.samples ?? 0, BASELINE_WARMUP);
        const deviation = baseline !== null && baseline > 0.01 && samples >= BASELINE_WARMUP ? powerKw / baseline : null;
        const nextBaseline = baseline === null
            ? powerKw
            : baseline + BASELINE_WEIGHT * (clamp(powerKw, baseline / BASELINE_PULL, baseline * BASELINE_PULL) - baseline);

        readings.set(sensorId, {
            powerKw,
            currentA: finiteNumber(reading.current_a),
            voltageV: positiveNumber(reading.voltage_v),
            readingAt,
            lastSeenAt: Math.max(lastSeenAt, previous?.lastSeenAt ?? 0),
            baseline: nextBaseline,
            deviation,
            samples: samples + 1,
            history: [...(previous?.history ?? []), powerKw].slice(-historyLength),
        });
        return true;
    };

    const ingest = (reading: IncomingReading, options: IngestOptions = {}): boolean => {
        const receivedAt = options.receivedAt ?? Date.now();
        const source = options.source ?? "stream";
        if (!reading || typeof reading.sensor_id !== "string" || reading.sensor_id === "") {
            return false;
        }
        if (typeof reading.building_id === "string" && reading.building_id !== buildingId) {
            return false;
        }
        const sensorId = reading.sensor_id;

        let changed = false;
        if (source === "snapshot" && Array.isArray(reading.recent)) {
            for (const earlier of reading.recent) {
                const earlierPower = finiteNumber(earlier?.power_kw);
                const earlierAt = parseTime(earlier?.timestamp);
                if (earlierPower !== null && earlierAt !== null) {
                    changed = record(sensorId, earlierPower, {}, earlierAt, Math.min(earlierAt, receivedAt)) || changed;
                }
            }
        }

        const powerKw = finiteNumber(reading.power_kw);
        if (powerKw !== null) {
            const readingAt = parseTime(reading.timestamp) ?? receivedAt;
            const lastSeenAt = source === "stream" ? receivedAt : Math.min(readingAt, receivedAt);
            const seed = source === "snapshot" ? positiveNumber(reading.baseline_kw) : null;
            const stored = record(sensorId, powerKw, reading, readingAt, lastSeenAt, seed);
            if (stored && source === "stream") {
                streamAt = receivedAt;
            }
            changed = stored || changed;
        }

        if (changed) {
            version += 1;
            listeners.forEach((listener) => listener());
        }
        return changed;
    };

    return {
        ingest,
        get: (sensorId) => readings.get(sensorId),
        version: () => version,
        lastStreamAt: () => streamAt,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}

export type LoadLens = "circuit" | "deviation";
export type StressBand = "normal" | "elevated" | "critical";
export type SensorState = "live" | "stale" | "waiting" | "offline" | "maintenance";

export type TwinLimits = {
    limitAmps: number;
    nominalVoltage: number;
};

export type SensorView = {
    sensor: TwinSensor;
    label: string;
    state: SensorState;
    powerKw: number | null;
    currentA: number | null;
    voltageV: number | null;
    loadShare: number | null;
    deviation: number | null;
    stress: number | null;
    band: StressBand | null;
    lastSeenAt: number | null;
    history: number[];
};

export function resolveLimits(building: TwinBuilding): TwinLimits {
    return {
        limitAmps: positiveNumber(building.max_current_threshold) ?? DEFAULT_LIMIT_AMPS,
        nominalVoltage: positiveNumber(building.nominal_voltage) ?? DEFAULT_VOLTAGE,
    };
}

export function circuitStress(loadShare: number): number {
    return clamp(loadShare, 0, 1);
}

export function deviationStress(ratio: number): number {
    const drift = Math.abs(ratio - 1);
    if (drift <= 0.3) {
        return (drift / 0.3) * ELEVATED_STRESS;
    }
    if (drift <= 0.5) {
        return ELEVATED_STRESS + ((drift - 0.3) / 0.2) * (CRITICAL_STRESS - ELEVATED_STRESS);
    }
    return Math.min(1, CRITICAL_STRESS + ((drift - 0.5) / 0.5) * (1 - CRITICAL_STRESS));
}

export function stressBand(stress: number): StressBand {
    if (stress >= CRITICAL_STRESS) {
        return "critical";
    }
    return stress >= ELEVATED_STRESS ? "elevated" : "normal";
}

function idleState(sensor: TwinSensor, hasReading: boolean): SensorState {
    if (sensor.status === "Maintenance") {
        return "maintenance";
    }
    if (sensor.status === "Offline") {
        return "offline";
    }
    return hasReading ? "stale" : "waiting";
}

export function describeSensor(
    sensor: TwinSensor,
    live: LiveReading | undefined,
    lens: LoadLens,
    limits: TwinLimits,
    now: number,
): SensorView {
    const label = sensorLabel(sensor);
    if (!live) {
        return {
            sensor,
            label,
            state: idleState(sensor, false),
            powerKw: null,
            currentA: null,
            voltageV: null,
            loadShare: null,
            deviation: null,
            stress: null,
            band: null,
            lastSeenAt: null,
            history: [],
        };
    }

    const voltage = live.voltageV ?? limits.nominalVoltage;
    const currentA = live.currentA ?? (live.powerKw * 1000) / voltage;
    const loadShare = currentA / limits.limitAmps;
    const view = {
        sensor,
        label,
        powerKw: live.powerKw,
        currentA,
        voltageV: live.voltageV,
        loadShare,
        deviation: live.deviation,
        lastSeenAt: live.lastSeenAt,
        history: live.history,
    };

    if (now - live.lastSeenAt > STALE_AFTER_MS) {
        return { ...view, state: idleState(sensor, true), stress: null, band: null };
    }

    let stress: number | null = circuitStress(loadShare);
    if (lens === "deviation") {
        stress = live.deviation === null ? null : deviationStress(live.deviation);
    }
    return { ...view, state: "live", stress, band: stress === null ? null : stressBand(stress) };
}

export type TwinSummary = {
    rows: SensorView[];
    totalKw: number;
    reporting: number;
    elevated: number;
    critical: number;
    peak: SensorView | null;
    lastSeenAt: number | null;
};

const STATE_ORDER: Record<SensorState, number> = { live: 0, stale: 1, maintenance: 2, waiting: 3, offline: 4 };

function compareViews(a: SensorView, b: SensorView): number {
    if (a.state !== b.state) {
        return STATE_ORDER[a.state] - STATE_ORDER[b.state];
    }
    const stressGap = (b.stress ?? -1) - (a.stress ?? -1);
    if (stressGap !== 0) {
        return stressGap;
    }
    const powerGap = (b.powerKw ?? -1) - (a.powerKw ?? -1);
    return powerGap !== 0 ? powerGap : compareText(a.label, b.label);
}

export function summariseSensors(views: SensorView[]): TwinSummary {
    const rows = [...views].sort(compareViews);
    const live = rows.filter((row) => row.state === "live");
    const peak = live.reduce<SensorView | null>(
        (best, row) => (best === null || (row.powerKw ?? 0) > (best.powerKw ?? 0) ? row : best),
        null,
    );
    const seen = rows.map((row) => row.lastSeenAt).filter((value): value is number => value !== null);

    return {
        rows,
        totalKw: live.reduce((total, row) => total + (row.powerKw ?? 0), 0),
        reporting: live.length,
        elevated: live.filter((row) => row.band === "elevated").length,
        critical: live.filter((row) => row.band === "critical").length,
        peak,
        lastSeenAt: seen.length > 0 ? Math.max(...seen) : null,
    };
}

export type StressPalette = Record<StressBand, string>;

const COLOUR_STOPS: Array<[number, StressBand]> = [
    [0, "normal"],
    [0.56, "normal"],
    [0.64, "elevated"],
    [0.81, "elevated"],
    [0.89, "critical"],
    [1, "critical"],
];

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
    const t = clamp(amount, 0, 1);
    return toHex(start.map((channel, index) => channel + (end[index] - channel) * t));
}

export function stressColour(stress: number, palette: StressPalette): string {
    const value = clamp(stress, 0, 1);
    for (let index = 1; index < COLOUR_STOPS.length; index += 1) {
        const [end, endBand] = COLOUR_STOPS[index];
        if (value <= end) {
            const [start, startBand] = COLOUR_STOPS[index - 1];
            return mixColours(palette[startBand], palette[endBand], end === start ? 1 : (value - start) / (end - start));
        }
    }
    return mixColours(palette.critical, palette.critical, 1);
}

export function stressGradient(palette: StressPalette): string {
    const stops = COLOUR_STOPS.map(([at, band]) => `${palette[band]} ${Math.round(at * 100)}%`);
    return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function formatKw(value: number | null): string {
    if (value === null) {
        return "-";
    }
    const digits = Math.abs(value) >= 100 ? 0 : 1;
    return `${value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} kW`;
}

export function formatAge(lastSeenAt: number | null, now: number): string {
    if (lastSeenAt === null) {
        return "No readings yet";
    }
    const seconds = Math.max(0, Math.round((now - lastSeenAt) / 1000));
    if (seconds < 3) {
        return "Just now";
    }
    if (seconds < 60) {
        return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes} min ago`;
    }
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}