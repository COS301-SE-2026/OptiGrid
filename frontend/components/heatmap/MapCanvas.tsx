"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import maplibregl, { type ExpressionSpecification, type GeoJSONSource, type MapLayerMouseEvent, type MapMouseEvent, type PaddingOptions, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { colourStops, parseColour, type Bounds, type HeatPalette, type HeatmapFeatureCollection, type TowerFeatureCollection } from "@/lib/heatmap";

export type MapPalette = HeatPalette & {
    primary: string;
    idle: string;
    surface: string;
};

export type FlyTarget = {
    longitude: number;
    latitude: number;
    token: number;
};

export type MapCanvasProps = {
    collection: HeatmapFeatureCollection;
    towers: TowerFeatureCollection;
    palette: MapPalette;
    dark: boolean;
    selectedId: string | null;
    fitTo: { bounds: Bounds; token: number } | null;
    flyTo: FlyTarget | null;
    placing: boolean;
    tilted: boolean;
    reducedMotion: boolean;
    active: boolean;
    onSelect: (buildingId: string | null) => void;
    onPlace: (coordinates: { longitude: number; latitude: number }) => void;
    onHover: (hover: { buildingId: string; x: number; y: number } | null) => void;
    onFailure: (message: string) => void;
};

const SOURCE = "buildings";
const TOWER_SOURCE = "towers";
const DATA_LAYERS = ["heat", "towers", "pulse", "halo", "points"];
const PICK_LAYERS = ["points", "towers"];
const FLAT_LAYERS = ["points", "pulse"];
const TILT_PITCH = 55;
const TILT_BEARING = -18;
const DEFAULT_CENTRE: [number, number] = [28.19, -25.75];
const HOT_STRESS = 0.8;
const STYLE_TIMEOUT_MS = 10000;
const BASEMAP_STYLES = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };

function fallbackStyle(dark: boolean): StyleSpecification {
    return {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": dark ? "#0B1120" : "#EEF7FF" } }],
    };
}

function basemapFor(dark: boolean, offline: boolean): string | StyleSpecification {
    if (offline) {
        return fallbackStyle(dark);
    }
    return dark ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light;
}

function withAlpha(colour: string, alpha: number): string {
    const [red, green, blue] = parseColour(colour);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function pointColour(palette: MapPalette): ExpressionSpecification {
    return [
        "case",
        ["==", ["get", "reporting"], 0],
        palette.idle,
        ["interpolate", ["linear"], ["get", "stress"], ...colourStops(palette)],
    ] as ExpressionSpecification;
}

function towerColour(palette: MapPalette): ExpressionSpecification {
    return [
        "case",
        ["==", ["get", "reporting"], 0],
        palette.idle,
        ["interpolate", ["linear"], ["get", "stress"], ...colourStops(palette)],
    ] as ExpressionSpecification;
}

function applyMode(map: maplibregl.Map, tilted: boolean) {
    if (!map.getLayer("towers")) {
        return;
    }
    map.setLayoutProperty("towers", "visibility", tilted ? "visible" : "none");
    for (const id of FLAT_LAYERS) {
        if (map.getLayer(id)) {
            map.setLayoutProperty(id, "visibility", tilted ? "none" : "visible");
        }
    }
}

function heatColour(palette: MapPalette): ExpressionSpecification {
    return [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0, "rgba(0, 0, 0, 0)",
        0.12, withAlpha(palette.low, 0.22),
        0.35, withAlpha(palette.low, 0.5),
        0.58, withAlpha(palette.moderate, 0.68),
        0.8, withAlpha(palette.high, 0.8),
        1, withAlpha(palette.high, 0.9),
    ] as ExpressionSpecification;
}

function pulseRadius(phase: number): ExpressionSpecification {
    return ["interpolate", ["linear"], ["zoom"], 4, 10 + phase * 18, 14, 18 + phase * 30] as ExpressionSpecification;
}

function fitPadding(container: HTMLElement): PaddingOptions {
    const height = container.clientHeight;
    const width = container.clientWidth;
    const side = Math.min(80, Math.max(24, width * 0.08));
    return {
        top: Math.min(170, Math.max(60, height * 0.24)),
        bottom: Math.min(200, Math.max(80, height * 0.28)),
        left: side,
        right: side,
    };
}

function addDataLayers(map: maplibregl.Map, collection: HeatmapFeatureCollection, towers: TowerFeatureCollection, palette: MapPalette, dark: boolean, tilted: boolean) {
    if (!map.getSource(SOURCE)) {
        map.addSource(SOURCE, { type: "geojson", data: collection });
    }
    if (!map.getSource(TOWER_SOURCE)) {
        map.addSource(TOWER_SOURCE, { type: "geojson", data: towers });
    }

    map.addLayer({
        id: "heat",
        type: "heatmap",
        source: SOURCE,
        paint: {
            "heatmap-weight": ["get", "weight"],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 1.1, 12, 2.4],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 34, 6, 58, 10, 80, 14, 110],
            "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.85, 16, 0.35],
            "heatmap-color": heatColour(palette),
        },
    });

    map.addLayer({
        id: "towers",
        type: "fill-extrusion",
        source: TOWER_SOURCE,
        layout: { visibility: tilted ? "visible" : "none" },
        paint: {
            "fill-extrusion-color": towerColour(palette),
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.82,
            "fill-extrusion-height-transition": { duration: 700 },
        },
    });

    map.addLayer({
        id: "pulse",
        type: "circle",
        source: SOURCE,
        filter: [">=", ["get", "stress"], HOT_STRESS],
        paint: {
            "circle-radius": pulseRadius(0),
            "circle-color": palette.high,
            "circle-opacity": 0,
            "circle-blur": 0.4,
        },
    });

    map.addLayer({
        id: "halo",
        type: "circle",
        source: SOURCE,
        filter: ["==", ["get", "buildingId"], ""],
        paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 15, 14, 32],
            "circle-color": "rgba(0, 0, 0, 0)",
            "circle-stroke-color": palette.primary,
            "circle-stroke-width": 3,
        },
    });

    map.addLayer({
        id: "points",
        type: "circle",
        source: SOURCE,
        paint: {
            "circle-radius": [
                "interpolate", ["linear"], ["zoom"],
                4, ["+", 5, ["*", ["get", "stress"], 6]],
                14, ["+", 10, ["*", ["get", "stress"], 14]],
            ],
            "circle-color": pointColour(palette),
            "circle-stroke-color": dark ? "#0B1120" : "#FFFFFF",
            "circle-stroke-width": 2,
            "circle-radius-transition": { duration: 600 },
            "circle-color-transition": { duration: 600 },
        },
    });
}

export default function MapCanvas(props: Readonly<MapCanvasProps>) {
    const { collection, towers, palette, dark, selectedId, fitTo, flyTo, placing, tilted, reducedMotion, active } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const readyRef = useRef(false);
    const fallbackRef = useRef(false);
    const themeRef = useRef(props.dark);
    const latest = useRef(props);

    useLayoutEffect(() => {
        latest.current = props;
    });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }

        let map: maplibregl.Map;
        try {
            map = new maplibregl.Map({
                container,
                style: basemapFor(latest.current.dark, false),
                center: DEFAULT_CENTRE,
                zoom: 5,
                minZoom: 2,
                maxZoom: 17,
                attributionControl: false,
                dragRotate: false,
                pitchWithRotate: false,
                fadeDuration: 0,
            });
        }
        catch {
            latest.current.onFailure("This browser cannot draw the map.");
            return;
        }

        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

        let firstStyle = true;
        const switchToFallback = () => {
            if (fallbackRef.current || readyRef.current) {
                return;
            }
            fallbackRef.current = true;
            map.setStyle(basemapFor(latest.current.dark, true), { diff: false });
        };
        const styleTimer = setTimeout(switchToFallback, STYLE_TIMEOUT_MS);

        map.on("style.load", () => {
            clearTimeout(styleTimer);
            const current = latest.current;
            addDataLayers(map, current.collection, current.towers, current.palette, current.dark, current.tilted);
            applyMode(map, current.tilted);
            map.setFilter("halo", ["==", ["get", "buildingId"], current.selectedId ?? ""]);
            readyRef.current = true;
            if (current.tilted) {
                map.jumpTo({ pitch: TILT_PITCH, bearing: TILT_BEARING });
            }
            if (firstStyle && current.flyTo) {
                map.jumpTo({ center: [current.flyTo.longitude, current.flyTo.latitude], zoom: 13 });
            } else if (firstStyle && current.fitTo) {
                map.fitBounds(current.fitTo.bounds, { padding: fitPadding(container), maxZoom: 13, duration: 0 });
            }
            firstStyle = false;
        });

        map.on("error", (event) => {
            const message = event?.error?.message ?? "";
            if (/webgl/i.test(message)) {
                latest.current.onFailure("This browser cannot draw the map.");
                return;
            }
            if (!readyRef.current) {
                switchToFallback();
            }
        });

        for (const layer of PICK_LAYERS) {
            map.on("click", layer, (event: MapLayerMouseEvent) => {
                if (latest.current.placing) {
                    return;
                }
                const buildingId = event.features?.[0]?.properties?.buildingId;
                if (typeof buildingId === "string") {
                    latest.current.onSelect(buildingId);
                }
            });

            map.on("mousemove", layer, (event: MapLayerMouseEvent) => {
                const buildingId = event.features?.[0]?.properties?.buildingId;
                if (typeof buildingId === "string" && !latest.current.placing) {
                    map.getCanvas().style.cursor = "pointer";
                    latest.current.onHover({ buildingId, x: event.point.x, y: event.point.y });
                }
            });

            map.on("mouseleave", layer, () => {
                map.getCanvas().style.cursor = latest.current.placing ? "crosshair" : "";
                latest.current.onHover(null);
            });
        }

        map.on("click", (event: MapMouseEvent) => {
            if (latest.current.placing) {
                latest.current.onPlace({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
                return;
            }
            const hits = readyRef.current ? map.queryRenderedFeatures(event.point, { layers: PICK_LAYERS.filter((layer) => map.getLayer(layer)) }) : [];
            if (hits.length === 0) {
                latest.current.onSelect(null);
            }
        });

        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => map.resize());
        observer?.observe(container);

        return () => {
            clearTimeout(styleTimer);
            observer?.disconnect();
            readyRef.current = false;
            mapRef.current = null;
            map.remove();
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || themeRef.current === dark) {
            return;
        }
        themeRef.current = dark;
        readyRef.current = false;
        map.setStyle(basemapFor(dark, fallbackRef.current), { diff: false });
    }, [dark]);

    useEffect(() => {
        const map = mapRef.current;
        if (map && readyRef.current) {
            (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(collection);
        }
    }, [collection]);

    useEffect(() => {
        const map = mapRef.current;
        if (map && readyRef.current) {
            (map.getSource(TOWER_SOURCE) as GeoJSONSource | undefined)?.setData(towers);
        }
    }, [towers]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !readyRef.current) {
            return;
        }
        applyMode(map, tilted);
        if (tilted) {
            map.dragRotate.enable();
        }
        else {
            map.dragRotate.disable();
        }
        map.easeTo({
            pitch: tilted ? TILT_PITCH : 0,
            bearing: tilted ? TILT_BEARING : 0,
            duration: reducedMotion ? 0 : 700,
        });
    }, [tilted, reducedMotion]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !readyRef.current || !DATA_LAYERS.every((id) => map.getLayer(id))) {
            return;
        }
        map.setPaintProperty("points", "circle-color", pointColour(palette));
        map.setPaintProperty("towers", "fill-extrusion-color", towerColour(palette));
        map.setPaintProperty("points", "circle-stroke-color", dark ? "#0B1120" : "#FFFFFF");
        map.setPaintProperty("heat", "heatmap-color", heatColour(palette));
        map.setPaintProperty("pulse", "circle-color", palette.high);
        map.setPaintProperty("halo", "circle-stroke-color", palette.primary);
    }, [palette, dark]);

    useEffect(() => {
        const map = mapRef.current;
        if (map && readyRef.current && map.getLayer("halo")) {
            map.setFilter("halo", ["==", ["get", "buildingId"], selectedId ?? ""]);
        }
    }, [selectedId, collection]);

    useEffect(() => {
        const map = mapRef.current;
        if (map) {
            map.getCanvas().style.cursor = placing ? "crosshair" : "";
        }
    }, [placing]);

    useEffect(() => {
        const map = mapRef.current;
        const container = containerRef.current;
        if (!map || !container || !fitTo || !readyRef.current) {
            return;
        }
        map.fitBounds(fitTo.bounds, { padding: fitPadding(container), maxZoom: 13, duration: reducedMotion ? 0 : 900 });
    }, [fitTo, reducedMotion]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !flyTo) {
            return;
        }
        map.flyTo({
            center: [flyTo.longitude, flyTo.latitude],
            zoom: Math.max(map.getZoom(), 13),
            duration: reducedMotion ? 0 : 1400,
            essential: true,
        });
    }, [flyTo, reducedMotion]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || reducedMotion || !active) {
            return;
        }
        let frame = 0;
        let last = 0;
        const start = performance.now();
        const tick = (time: number) => {
            frame = requestAnimationFrame(tick);
            if (time - last < 50 || !readyRef.current || !map.getLayer("pulse")) {
                return;
            }
            last = time;
            const phase = ((time - start) % 1800) / 1800;
            map.setPaintProperty("pulse", "circle-radius", pulseRadius(phase));
            map.setPaintProperty("pulse", "circle-opacity", 0.5 * (1 - phase));
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
            if (readyRef.current && map.getLayer("pulse")) {
                map.setPaintProperty("pulse", "circle-opacity", 0);
            }
        };
    }, [reducedMotion, active]);

    return <div ref={containerRef} className="heat-map-canvas" />;
}