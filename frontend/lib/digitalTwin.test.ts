import { BASELINE_WARMUP, MAX_PANELS, STALE_AFTER_MS, buildMassing, buildTwinLayout, buildingTypeLabel, describeBuilding, solarPanelCount, windowSpacingFor, cameraFraming, footprintAtFloor, classifyZone, createReadingStore, deviationStress, describeSensor, formatAge, formatKw,
    measurePath, mixColours, parseColour, resolveLimits, stressBand, stressColour, stressGradient, summariseSensors, writePointAlongPath, type TwinBuilding, type TwinSensor
} from "./digitalTwin";

const office: TwinBuilding = {
    building_id: "building-1",
    building_name: "Hatfield Block C",
    building_type: "Commercial",
    square_footage: 2500,
    nominal_voltage: 230,
    max_current_threshold: 60,
};

const palette = { normal: "#2F7D5D", elevated: "#B26B00", critical: "#B23B3B" };
const T0 = Date.parse("2026-09-17T10:00:00.000Z");

function sensor(sensorId: string, zone: string | null, extra: Partial<TwinSensor> = {}): TwinSensor {
    return { sensor_id: sensorId, location_zone: zone, sensor_type: "Energy Monitor", status: "Active", ...extra };
}

function reading(sensorId: string, powerKw: number, secondsAfter: number, extra: Record<string, unknown> = {}) {
    return {
        building_id: "building-1",
        sensor_id: sensorId,
        power_kw: powerKw,
        timestamp: new Date(T0 + secondsAfter * 1000).toISOString(),
        ...extra,
    };
}

describe("buildTwinLayout", () => {
    it("gets the size of a commercial building from its floor area", () => {
        const layout = buildTwinLayout(office, []);

        expect(layout.floors).toBe(4);
        expect(layout.floorHeight).toBe(1.3);
        expect(layout.height).toBe(5.2);
        expect(layout.width).toBeCloseTo(10.083, 3);
        expect(layout.depth).toBeCloseTo(10.083, 3);
        expect(layout.incomer).toEqual([8.041, 0, 1.815]);
        expect(layout.placements).toEqual([]);
        expect(layout.flows).toHaveLength(2);
        expect(layout.flows.every((flow) => flow.driver === null)).toBe(true);
    });

    it("keeps the floor count within what each building type allows", () => {
        expect(buildTwinLayout({ building_id: "b", building_type: "Residential", square_footage: 80 }, []).floors).toBe(2);
        expect(buildTwinLayout({ building_id: "b", building_type: "Industrial", square_footage: "20000" }, []).floors).toBe(2);
        expect(buildTwinLayout({ building_id: "b", building_type: "OFFICE", square_footage: null }, []).floors).toBe(3);
        expect(buildTwinLayout({ building_id: "b", building_type: "Residential", square_footage: 90000 }, []).floors).toBe(12);
    });

    it("recognises where a zone name puts a sensor", () => {
        expect(classifyZone("Main incomer")).toEqual({ kind: "incomer" });
        expect(classifyZone("Main")).toEqual({ kind: "incomer" });
        expect(classifyZone("Grid supply")).toEqual({ kind: "incomer" });
        expect(classifyZone("Main Hall")).toEqual({ kind: "zone" });
        expect(classifyZone("Floor 3 East")).toEqual({ kind: "floor", floor: 3 });
        expect(classifyZone("L2 Kitchen")).toEqual({ kind: "floor", floor: 2 });
        expect(classifyZone("Ground floor lobby")).toEqual({ kind: "floor", floor: 0 });
        expect(classifyZone("Rooftop chiller")).toEqual({ kind: "roof" });
        expect(classifyZone("Zone 1")).toEqual({ kind: "zone" });
    });

    it("places every sensor by zone and grows the building for a named floor", () => {
        const sensors = [
            sensor("s-b", "Zone 2"),
            sensor("s-m", "Main incomer"),
            sensor("s-a", "Zone 1"),
            sensor("s-r", "Rooftop chiller"),
            sensor("s-f", "Floor 9"),
        ];
        const layout = buildTwinLayout(office, sensors);
        const byId = new Map(layout.placements.map((placement) => [placement.sensor.sensor_id, placement]));

        expect(layout.floors).toBe(10);
        expect(layout.placements).toHaveLength(5);
        expect(byId.get("s-m")).toEqual(expect.objectContaining({ kind: "incomer", floor: 0 }));
        expect(byId.get("s-m")?.position).toEqual([layout.incomer[0], 1.35, layout.incomer[2]]);
        expect(byId.get("s-a")).toEqual(expect.objectContaining({ kind: "floor", floor: 0 }));
        expect(byId.get("s-b")).toEqual(expect.objectContaining({ kind: "floor", floor: 9 }));
        expect(byId.get("s-f")).toEqual(expect.objectContaining({ kind: "floor", floor: 9 }));
        expect(byId.get("s-r")).toEqual(expect.objectContaining({ kind: "roof", floor: 10 }));
        expect(byId.get("s-r")?.position[1]).toBeCloseTo(layout.height + 0.55, 3);

        for (const placement of layout.placements.filter((item) => item.kind === "floor")) {
            const [x, y, z] = placement.position;
            expect(Math.abs(x)).toBeLessThanOrEqual(layout.width / 2);
            expect(Math.abs(z)).toBeLessThanOrEqual(layout.depth / 2);
            expect(y).toBeGreaterThan(placement.floor * layout.floorHeight);
            expect(y).toBeLessThan((placement.floor + 1) * layout.floorHeight);
        }
    });


    it("gives the same layout whatever order the sensors arrive in", () => {
        const sensors = [sensor("s-1", "Zone 1"), sensor("s-2", "Zone 1"), sensor("s-3", null), sensor("s-4", "Plant room")];
        const forward = buildTwinLayout(office, sensors);
        const reversed = buildTwinLayout(office, [...sensors].reverse());

        expect(reversed).toEqual(forward);
    });
    it("routes power from the grid to incomers and up the riser to every other sensor", () => {
        const layout = buildTwinLayout(office, [sensor("s-m", "Main"), sensor("s-a", "Zone 1")]);
        const incomerFlow = layout.flows.find((flow) => flow.driver === "s-m");
        const zoneFlow = layout.flows.find((flow) => flow.driver === "s-a");
        const zonePlacement = layout.placements.find((placement) => placement.sensor.sensor_id === "s-a");

        expect(layout.flows).toHaveLength(3);
        expect(incomerFlow?.points[0]).toEqual(layout.gridSource);
        expect(zoneFlow?.points[0]).toEqual([0, 0.35, 0]);
        expect(zoneFlow?.points.at(-1)).toEqual(zonePlacement?.position);
    });


    it("turns a lone sensor towards the default camera", () => {
        const [placement] = buildTwinLayout(office, [sensor("s-1", "Zone 1")]).placements;

        expect(placement.position[0]).toBeGreaterThan(0);
        expect(placement.position[2]).toBeGreaterThan(0);
    });

    it("frames the whole site from above and in front", () => {
        const layout = buildTwinLayout(office, []);
        const framing = cameraFraming(layout);
        const distance = Math.hypot(
            framing.position[0] - framing.target[0],
            framing.position[1] - framing.target[1],
            framing.position[2] - framing.target[2],
        );

        expect(framing.target[1]).toBeCloseTo(layout.height * 0.42, 3);
        expect(distance).toBeGreaterThan(layout.radius * 2);
        expect(framing.position[1]).toBeGreaterThan(framing.target[1]);
        expect(framing.minDistance).toBeLessThan(distance);
        expect(framing.maxDistance).toBeGreaterThan(distance);
    });
});


describe("createReadingStore", () => {
    it("only keeps valid readings for its own building", () => {
        const store = createReadingStore("building-1");

        expect(store.ingest({ ...reading("s-1", 5, 0), building_id: "building-2" })).toBe(false);
        expect(store.ingest({ ...reading("s-1", 5, 0), sensor_id: "" })).toBe(false);
        expect(store.ingest(reading("s-1", Number.NaN, 0))).toBe(false);
        expect(store.version()).toBe(0);

        expect(store.ingest(reading("s-1", "7.5" as unknown as number, 0, { current_a: "32.6", voltage_v: 230 }), { receivedAt: T0 })).toBe(true);
        expect(store.get("s-1")).toEqual(expect.objectContaining({ powerKw: 7.5, currentA: 32.6, voltageV: 230, readingAt: T0, lastSeenAt: T0 }));
        expect(store.version()).toBe(1);
    });

    it("ignores any readings which are older than or equal to the latest one", () => {
        const store = createReadingStore("building-1");
        store.ingest(reading("s-1", 5, 10), { receivedAt: T0 });

        expect(store.ingest(reading("s-1", 9, 5), { receivedAt: T0 })).toBe(false);
        expect(store.ingest(reading("s-1", 9, 10), { receivedAt: T0 })).toBe(false);
        expect(store.get("s-1")?.powerKw).toBe(5);
    });

    it("learns a baseline before judging deviation and resists spikes and drops", () => {
        const store = createReadingStore("building-1");
        for (let second = 0; second < 5; second += 1) {
            store.ingest(reading("s-1", 10, second));
            expect(store.get("s-1")?.deviation).toBeNull();
        }

        store.ingest(reading("s-1", 50, 5));
        const afterSpike = store.get("s-1");
        expect(afterSpike?.deviation).toBe(5);
        expect(afterSpike?.baseline).toBeCloseTo(10.1, 5);
        expect(afterSpike?.samples).toBe(6);

        store.ingest(reading("s-1", 0.5, 6));
        const afterDrop = store.get("s-1");
        expect(afterDrop?.deviation).toBeCloseTo(0.5 / 10.1, 5);
        expect(afterDrop?.baseline).toBeCloseTo(10.1 + 0.02 * (10.1 / 1.5 - 10.1), 5);
    });

    it("keeps flagging a sustained anomaly for half a minute of two second readings", () => {
        const store = createReadingStore("building-1");
        for (let second = 0; second < 5; second += 1) {
            store.ingest(reading("s-1", 10, second));
        }
        for (let second = 5; second < 20; second += 1) {
            store.ingest(reading("s-1", 18, second));
        }

        expect(deviationStress(store.get("s-1")?.deviation ?? 1)).toBeGreaterThanOrEqual(0.85);
    });

    it("starts from a baseline supplied with the snapshot", () => {
        const store = createReadingStore("building-1");
        store.ingest(
            { sensor_id: "s-1", power_kw: 12, baseline_kw: 8, timestamp: new Date(T0).toISOString() },
            { source: "snapshot", receivedAt: T0 },
        );
        store.ingest({ sensor_id: "s-2", power_kw: 12, baseline_kw: 8, timestamp: new Date(T0).toISOString() }, { receivedAt: T0 });

        expect(store.get("s-1")).toEqual(expect.objectContaining({ deviation: 1.5, samples: BASELINE_WARMUP + 1 }));
        expect(store.get("s-2")?.deviation).toBeNull();
    });

    it("keeps a bounded history of recent draw", () => {
        const store = createReadingStore("building-1", 3);
        [1, 2, 3, 4, 5].forEach((power, second) => store.ingest(reading("s-1", power, second)));
        expect(store.get("s-1")?.history).toEqual([3, 4, 5]);
    });

    it("dates snapshot readings by when they were taken and warms up from recent history", () => {
        const store = createReadingStore("building-1");
        const receivedAt = T0 + 60000;
        store.ingest({
            sensor_id: "s-1",
            power_kw: 12,
            current_a: 52,
            timestamp: new Date(T0 + 30000).toISOString(),
            recent: [
                { power_kw: 10, timestamp: new Date(T0).toISOString() },
                { power_kw: 11, timestamp: new Date(T0 + 10000).toISOString() },
                { power_kw: "bad", timestamp: new Date(T0 + 20000).toISOString() },
            ],
        }, { source: "snapshot", receivedAt });

        const live = store.get("s-1");
        expect(live?.history).toEqual([10, 11, 12]);
        expect(live?.lastSeenAt).toBe(T0 + 30000);
        expect(live?.currentA).toBe(52);
        expect(store.lastStreamAt()).toBeNull();
        expect(store.version()).toBe(1);

        store.ingest(reading("s-1", 13, 40), { receivedAt: receivedAt + 1000 });
        expect(store.lastStreamAt()).toBe(receivedAt + 1000);
        expect(store.get("s-1")?.lastSeenAt).toBe(receivedAt + 1000);
    });

    it("it only tells subscribers about accepted readings", () => {
        const store = createReadingStore("building-1");
        const listener = jest.fn();
        const unsubscribe = store.subscribe(listener);

        store.ingest(reading("s-1", 5, 0));
        store.ingest(reading("s-1", 5, 0));
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        store.ingest(reading("s-1", 6, 1));
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe("flow paths", () => {
    const path = measurePath([[0, 0, 0], [3, 4, 0], [3, 4, 2]]);

    it("measures every segment", () => {
        expect(path.length).toBe(7);
        expect(path.cumulative).toEqual([0, 5, 7]);
    });

    it("walks along the path by share of its length", () => {
        const target = new Float32Array(6);

        writePointAlongPath(path, 0.5, target, 3);
        expect(Array.from(target.slice(3))).toEqual([expect.closeTo(2.1, 5), expect.closeTo(2.8, 5), 0]);

        writePointAlongPath(path, 1.4, target, 0);
        expect(Array.from(target.slice(0, 3))).toEqual([3, 4, 2]);

        writePointAlongPath(path, 0, target, 0);
        expect(Array.from(target.slice(0, 3))).toEqual([0, 0, 0]);
    });
});

describe("describeSensor", () => {
    const limits = resolveLimits(office);

    it("falls back to the sensible circuit limits", () => {
        expect(resolveLimits({ building_id: "b", max_current_threshold: null, nominal_voltage: 0 })).toEqual({ limitAmps: 60, nominalVoltage: 230 });
        expect(limits).toEqual({ limitAmps: 60, nominalVoltage: 230 });
    });

    it("explains sensors without a reading from their registered status", () => {
        expect(describeSensor(sensor("s-1", "Zone 1"), undefined, "circuit", limits, T0).state).toBe("waiting");
        expect(describeSensor(sensor("s-1", "Zone 1", { status: "Offline" }), undefined, "circuit", limits, T0).state).toBe("offline");
        expect(describeSensor(sensor("s-1", null, { status: "Maintenance" }), undefined, "circuit", limits, T0)).toEqual(expect.objectContaining({
            state: "maintenance",
            label: "Energy Monitor",
            powerKw: null,
            stress: null,
        }));
    });

    
    it("figures out the current from power when the reading has none", () => {
        const store = createReadingStore("building-1");
        store.ingest(reading("s-1", 6.9, 0), { receivedAt: T0 });

        const view = describeSensor(sensor("s-1", "Zone 1"), store.get("s-1"), "circuit", limits, T0);
        expect(view.currentA).toBeCloseTo(30, 5);
        expect(view.loadShare).toBeCloseTo(0.5, 5);
        expect(view.band).toBe("normal");
    });

    it("rates live load against the circuit limit", () => {
        const store = createReadingStore("building-1");
        store.ingest(reading("s-1", 12.4, 0, { current_a: 54, voltage_v: 229.6 }), { receivedAt: T0 });

        const view = describeSensor(sensor("s-1", "Zone 1"), store.get("s-1"), "circuit", limits, T0 + 1000);
        expect(view).toEqual(expect.objectContaining({
            state: "live",
            label: "Zone 1",
            powerKw: 12.4,
            currentA: 54,
            voltageV: 229.6,
            loadShare: 0.9,
            stress: 0.9,
            band: "critical",
        }));
    });

    it("marks a reading as lost once the stream goes quiet", () => {
        const store = createReadingStore("building-1");
        store.ingest(reading("s-1", 6.9, 0), { receivedAt: T0 });
        const later = T0 + STALE_AFTER_MS + 1;

        expect(describeSensor(sensor("s-1", "Zone 1"), store.get("s-1"), "circuit", limits, later)).toEqual(expect.objectContaining({
            state: "stale",
            powerKw: 6.9,
            stress: null,
            band: null,
        }));
        expect(describeSensor(sensor("s-1", "Zone 1", { status: "Maintenance" }), store.get("s-1"), "circuit", limits, later).state).toBe("maintenance");
    });

    it("waits for a baseline before rating a deviation", () => {
        const store = createReadingStore("building-1");
        store.ingest(reading("s-1", 10, 0), { receivedAt: T0 });
        expect(describeSensor(sensor("s-1", "Zone 1"), store.get("s-1"), "deviation", limits, T0)).toEqual(
            expect.objectContaining({ state: "live", stress: null, band: null }),
        );

        for (let second = 1; second <= 5; second += 1) {
            store.ingest(reading("s-1", 10, second), { receivedAt: T0 });
        }
        store.ingest(reading("s-1", 16, 6), { receivedAt: T0 });
        const view = describeSensor(sensor("s-1", "Zone 1"), store.get("s-1"), "deviation", limits, T0);
        expect(view.deviation).toBeCloseTo(1.6, 5);
        expect(view.band).toBe("critical");
    });
});

describe("stress scale", () => {
    it("treats drift in either direction as stress", () => {
        expect(deviationStress(1)).toBe(0);
        expect(deviationStress(1.3)).toBeCloseTo(0.6, 5);
        expect(deviationStress(0.7)).toBeCloseTo(0.6, 5);
        expect(deviationStress(1.5)).toBeCloseTo(0.85, 5);
        expect(deviationStress(2)).toBeCloseTo(1, 5);
        expect(deviationStress(0)).toBeCloseTo(1, 5);
    });

    it("marks stress at 60 and 85 percent", () => {
        expect(stressBand(0.59)).toBe("normal");
        expect(stressBand(0.6)).toBe("elevated");
        expect(stressBand(0.84)).toBe("elevated");
        expect(stressBand(0.85)).toBe("critical");
    });

    
    it("reads hex and rgb colour tokens", () => {
        expect(parseColour("#fff")).toEqual([255, 255, 255]);
        expect(parseColour(" rgb(95, 191, 147) ")).toEqual([95, 191, 147]);
        expect(parseColour("rgba(11 17 32 / 0.5)")).toEqual([11, 17, 32]);
        expect(parseColour("not a colour")).toEqual([128, 128, 128]);
    });

    it("colours stress with the theme palette", () => {
        expect(stressColour(0, palette)).toBe("#2f7d5d");
        expect(stressColour(0.5, palette)).toBe("#2f7d5d");
        expect(stressColour(0.584, palette)).toBe("#567841");
        expect(mixColours("#2F7D5D", "#B26B00", 0.3)).toBe("#567841");
        expect(stressColour(0.7, palette)).toBe("#b26b00");
        expect(stressColour(0.95, palette)).toBe("#b23b3b");
        expect(stressColour(4, palette)).toBe("#b23b3b");
        expect(stressGradient(palette)).toBe(
            "linear-gradient(90deg, #2F7D5D 0%, #2F7D5D 56%, #B26B00 64%, #B26B00 81%, #B23B3B 89%, #B23B3B 100%)",
        );
    });
});

describe("summariseSensors", () => {
    it("ranks the busiest sensors first and totals live load", () => {
        const store = createReadingStore("building-1");
        store.ingest(reading("hot", 13.8, 0, { current_a: 58 }), { receivedAt: T0 });
        store.ingest(reading("warm", 9.9, 0, { current_a: 42 }), { receivedAt: T0 });
        store.ingest(reading("cool", 20, 0, { current_a: 12 }), { receivedAt: T0 });
        store.ingest(reading("quiet", 3, 0), { receivedAt: T0 - STALE_AFTER_MS - 1 });
        const sensors = [
            sensor("quiet", "Zone 4"),
            sensor("idle", "Zone 5"),
            sensor("cool", "Zone 3"),
            sensor("hot", "Zone 1"),
            sensor("warm", "Zone 2"),
            sensor("down", "Zone 6", { status: "Offline" }),
        ];

        const summary = summariseSensors(sensors.map((item) => describeSensor(item, store.get(item.sensor_id), "circuit", resolveLimits(office), T0)));

        expect(summary.rows.map((row) => row.sensor.sensor_id)).toEqual(["hot", "warm", "cool", "quiet", "idle", "down"]);
        expect(summary.totalKw).toBeCloseTo(43.7, 5);
        expect(summary.reporting).toBe(3);
        expect(summary.critical).toBe(1);
        expect(summary.elevated).toBe(1);
        expect(summary.peak?.sensor.sensor_id).toBe("cool");
        expect(summary.lastSeenAt).toBe(T0);
    });

    it("reports nothing when no sensor is live", () => {
        const summary = summariseSensors([describeSensor(sensor("s-1", null), undefined, "circuit", resolveLimits(office), T0)]);
        expect(summary).toEqual(expect.objectContaining({ totalKw: 0, reporting: 0, peak: null, lastSeenAt: null }));
    });
});

describe("formatting", () => {
    it("describes how long ago a sensor was heard from", () => {
        expect(formatAge(null, T0)).toBe("No readings yet");
        expect(formatAge(T0 - 1000, T0)).toBe("Just now");
        expect(formatAge(T0 + 5000, T0)).toBe("Just now");
        expect(formatAge(T0 - 12000, T0)).toBe("12s ago");
        expect(formatAge(T0 - 150000, T0)).toBe("3 min ago");
        expect(formatAge(T0 - 2 * 3600000, T0)).toBe("2 h ago");
        expect(formatAge(T0 - 3 * 86400000, T0)).toBe("3 d ago");
    });

    it("shows power with sensible precision", () => {
        expect(formatKw(null)).toBe("-");
        expect(formatKw(12.345)).toBe("12.3 kW");
        expect(formatKw(0)).toBe("0.0 kW");
        expect(formatKw(150.4)).toBe("150 kW");
    });
});

describe("building massing", () => {
    const sensorsFor = (zones: string[]): TwinSensor[] =>
        zones.map((zone, index) => ({ sensor_id: `s${index}`, location_zone: zone, status: "Active" as const }));

    const layoutFor = (type: string, area: number, zones: string[] = ["Main incomer", "Floor 1"]) =>
        buildTwinLayout({ building_id: "b", building_name: type, building_type: type, square_footage: area }, sensorsFor(zones));

    it("gives an office a podium with a narrower tower above it", () => {
        const massing = buildMassing("podium", 12, 10, 9, 1.3);
        expect(massing.blocks.map((block) => block.id)).toEqual(["podium", "tower"]);
        const [podium, tower] = massing.blocks;
        expect(tower.width).toBeLessThan(podium.width);
        expect(tower.baseFloor).toBe(podium.floors);
        expect(podium.baseFloor + podium.floors + tower.floors).toBe(9 + podium.baseFloor);
        expect(massing.facade).toBe("glass");
    });

    it("leaves a short office as one volume", () => {
        const massing = buildMassing("podium", 12, 10, 3, 1.3);
        expect(massing.blocks).toHaveLength(1);
        expect(massing.form).toBe("tower");
    });

    it("pitches the roof of a low block of flats but not a tall one", () => {
        expect(buildMassing("slab", 9, 11, 4, 1.15).roof).toBe("pitched");
        expect(buildMassing("slab", 9, 11, 9, 1.15).roof).toBe("flat");
    });

    
    it("gives a warehouse a sawtooth roof and no glass", () => {
        const massing = buildMassing("shed", 14, 9, 1, 2.6);
        expect(massing.roof).toBe("sawtooth");
        expect(massing.facade).toBe("panel");
        expect(massing.bays).toBeGreaterThanOrEqual(3);
        expect(massing.roofRise).toBeGreaterThan(0);
    });

    it("spreads a hospital into a core with two wings", () => {
        const massing = buildMassing("wings", 14, 10, 5, 1.4);
        expect(massing.blocks.map((block) => block.id)).toEqual(["core", "wing-west", "wing-east"]);
        const [, west, east] = massing.blocks;
        expect(west.centreX).toBeCloseTo(-east.centreX, 5);
        expect(west.floors).toBeLessThan(massing.blocks[0].floors);
    });

    it("arches the roof of a shopping centre", () => {
        expect(buildMassing("mall", 16, 11, 2, 1.8).roof).toBe("vaulted");
    });

    it("keeps a construction site as a bare frame", () => {
        const massing = buildMassing("frame", 10, 10, 4, 1.3);
        expect(massing.facade).toBe("frame");
        expect(massing.plant).toBe(false);
    });

    it("reads the footprint of whatever stands at a level", () => {
        const massing = buildMassing("podium", 12, 10, 9, 1.3);
        const low = footprintAtFloor(massing, 0);
        const high = footprintAtFloor(massing, 8);
        expect(low.width).toBeGreaterThan(high.width);
        expect(footprintAtFloor(massing, 99).width).toBe(high.width);
    });

    it("covers the whole plan of a hospital at ground level", () => {
        const massing = buildMassing("wings", 14, 10, 5, 1.4);
        const ground = footprintAtFloor(massing, 0);
        expect(ground.width).toBeGreaterThan(massing.blocks[0].width);
        expect(ground.centreX).toBeCloseTo(0, 5);
    });

    it("builds a different shape for each kind of building", () => {
        const office = layoutFor("Commercial", 6000);
        const works = layoutFor("Industrial", 6000);
        const flats = layoutFor("Residential", 6000);
        const hospital = layoutFor("Healthcare", 6000);

        expect(office.massing.form).toBe("podium");
        expect(works.massing.roof).toBe("sawtooth");
        expect(flats.massing.facade).toBe("punched");
        expect(hospital.massing.blocks).toHaveLength(3);
        expect(works.floors).toBeLessThan(flats.floors);
        expect(works.width).toBeGreaterThan(flats.width);
    });

    it("places a sensor inside the volume that stands at its level", () => {
        const layout = layoutFor("Commercial", 9000, ["Main incomer", "Floor 1", "Floor 7"]);
        const high = layout.placements.find((placement) => placement.floor === 7);
        const low = layout.placements.find((placement) => placement.kind === "floor" && placement.floor === 1);
        expect(high).toBeDefined();
        expect(low).toBeDefined();
        const towerHalf = layout.massing.blocks[layout.massing.blocks.length - 1].width / 2;
        expect(Math.abs(high!.position[0])).toBeLessThanOrEqual(towerHalf + 0.5);
    });
});

describe("building description", () => {
    it("reads a stored type as plain words", () => {
        expect(buildingTypeLabel("ShoppingCentre")).toBe("Shopping centre");
        expect(buildingTypeLabel("Mixed_Use")).toBe("Mixed use");
        expect(buildingTypeLabel("Commercial")).toBe("Commercial");
        expect(buildingTypeLabel(null)).toBe("Building");
        expect(buildingTypeLabel("   ")).toBe("Building");
    });

    it("lists what the model was built from", () => {
        const building = { building_id: "b", building_type: "Industrial", square_footage: 4200 };
        const layout = buildTwinLayout(building, [{ sensor_id: "s", location_zone: "Main incomer" }]);
        expect(describeBuilding(building, layout)).toEqual(["Industrial", `${layout.floors === 1 ? "1 floor" : `${layout.floors} floors`}`, "4,200 m\u00B2"]);
    });

    it("leaves the area out when it is unknown", () => {
        const building = { building_id: "b", building_type: "Commercial" };
        const layout = buildTwinLayout(building, []);
        expect(describeBuilding(building, layout)).toHaveLength(2);
    });
});

describe("building detail", () => {
    it("fits an office with shading fins, a canopy and rooftop plant", () => {
        const detail = buildMassing("podium", 12, 10, 9, 1.3).detail;
        expect(detail.entrance).toBe("canopy");
        expect(detail.fins).toBe(true);
        expect(detail.parapet).toBe(true);
        expect(detail.plantUnits).toBeGreaterThan(0);
        expect(detail.windows).toBe(false);
    });

    it("keeps balconies off a two storey block", () => {
        expect(buildMassing("slab", 9, 11, 2, 1.15).detail.balconies).toBe(false);
    });

    it("gives flats windows and balconies but no shading fins", () => {
        const detail = buildMassing("slab", 9, 11, 4, 1.15).detail;
        expect(detail.windows).toBe(true);
        expect(detail.balconies).toBe(true);
        expect(detail.fins).toBe(false);
    });


    it("gives a warehouse loading bays instead of a front door", () => {
        const detail = buildMassing("shed", 14, 9, 1, 2.6).detail;
        expect(detail.entrance).toBe("dock");
        expect(detail.docks).toBeGreaterThanOrEqual(2);
        expect(detail.windows).toBe(false);
        expect(detail.parapet).toBe(false);
    });

    it("fronts a shopping centre with glazing", () => {
        expect(buildMassing("mall", 16, 11, 2, 1.8).detail.entrance).toBe("shopfront");
    });

    it("leaves a construction site bare", () => {
        const detail = buildMassing("frame", 10, 10, 4, 1.3).detail;
        expect(detail.entrance).toBe("none");
        expect(detail.plantUnits).toBe(0);
        expect(detail.parapet).toBe(false);
    });

    it("carries detail through a built layout", () => {
        const layout = buildTwinLayout(
            { building_id: "b", building_type: "Healthcare", square_footage: 6000 },
            [{ sensor_id: "s", location_zone: "Main incomer" }],
        );
        expect(layout.massing.detail.windows).toBe(true);
        expect(layout.massing.detail.entrance).toBe("canopy");
    });
});

describe("recorded building facts", () => {
    const sensors: TwinSensor[] = [{ sensor_id: "s", location_zone: "Main incomer" }];

    it("trusts a recorded storey count over one guessed from area", () => {
        const guessed = buildTwinLayout({ building_id: "b", building_type: "Commercial", square_footage: 6000 }, sensors);
        const stated = buildTwinLayout(
            { building_id: "b", building_type: "Commercial", square_footage: 6000, floors_above_ground: 4 },
            sensors,
        );
        expect(guessed.floors).not.toBe(4);
        expect(stated.floors).toBe(4);
    });

    it("ignores a storey count which makes no sense", () => {
        const layout = buildTwinLayout(
            { building_id: "b", building_type: "Commercial", square_footage: 6000, floors_above_ground: 0 },
            sensors,
        );
        expect(layout.floors).toBeGreaterThan(0);
    });

    it("still leaves room for a sensor named on a higher floor", () => {
        const layout = buildTwinLayout(
            { building_id: "b", building_type: "Commercial", floors_above_ground: 2 },
            [{ sensor_id: "s", location_zone: "Floor 6" }],
        );
        expect(layout.floors).toBe(7);
    });

    it("counts rooftop panels from the declared capacity", () => {
        expect(solarPanelCount({ building_id: "b" })).toBe(0);
        expect(solarPanelCount({ building_id: "b", solar_capacity_kw: 0 })).toBe(0);
        expect(solarPanelCount({ building_id: "b", solar_capacity_kw: 9 })).toBe(20);
        expect(solarPanelCount({ building_id: "b", solar_capacity_kw: "4.5" })).toBe(10);
    });

    it("keeps a very large array readable", () => {
        expect(solarPanelCount({ building_id: "b", solar_capacity_kw: 5000 })).toBe(MAX_PANELS);
    });

    it("tightens the window rhythm as a floor gets busier", () => {
        const sparse = windowSpacingFor({ building_id: "b", max_occupancy: 10 }, 1000);
        const packed = windowSpacingFor({ building_id: "b", max_occupancy: 400 }, 1000);
        expect(packed).toBeLessThan(sparse);
        expect(windowSpacingFor({ building_id: "b" }, 1000)).toBe(1.35);
        expect(packed).toBeGreaterThanOrEqual(0.95);
    });
});