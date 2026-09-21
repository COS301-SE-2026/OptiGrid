"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeading } from "@/components/PageHeading";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { useTelemetryStream } from "@/lib/useTelemetryStream";
import { readThemeToken, useDarkTheme, useOnScreen, useReducedMotion } from "@/lib/useDisplayPreferences";
import {
    BASELINE_TIMEFRAME,
    LIVE_INDEX,
    TIMEFRAMES,
    boundsOf,
    changeAgainst,
    coordinatesOf,
    createPortfolioStore,
    formatChange,
    formatEnergy,
    formatIntensity,
    metricValue,
    portfolioTotals,
    rankPoints,
    scaleOf,
    stressBand,
    stressColour,
    stressGradient,
    stressOf,
    timeframeAt,
    toFeatureCollection,
    toTowerCollection,
    type HeatmapBuilding,
    type HeatmapMetric,
    type HeatmapPoint,
    type HeatmapSnapshot,
    type StressBand,
    type Timeframe,
    type TimeframeId,
} from "@/lib/heatmap";
import { fetchHeatmapSnapshot } from "@/lib/heatmapSource";
import TimelineScrubber from "./TimelineScrubber";
import type { FlyTarget, MapPalette } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
    ssr: false,
    loading: () => <StageNote loading title="Loading the map" />,
});

const PLAY_STEP_MS = 2200;
const LIST_LIMIT = 40;
const EMPTY_BUILDINGS: HeatmapBuilding[] = [];

const BAND_LABELS: Record<StressBand, string> = {
    low: "Low",
    moderate: "Moderate",
    high: "High",
};

const BAND_BADGES: Record<StressBand, string> = {
    low: "badge-success",
    moderate: "badge-warning",
    high: "badge-danger",
};

const METRICS: Array<{ value: HeatmapMetric; label: string }> = [
    { value: "total", label: "Total" },
    { value: "intensity", label: "Per m²" },
];

type Placement = {
    building: HeatmapBuilding;
    error: string | null;
    saving: boolean;
};

async function fetchBuildings(): Promise<HeatmapBuilding[]> {
    const response = await fetch("/api/buildings", { method: "GET", cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as { data?: HeatmapBuilding[]; message?: string };
    if (!response.ok) {
        throw new Error(payload.message || "Unable to load your buildings.");
    }
    return Array.isArray(payload.data) ? payload.data : [];
}

function readPalette(): MapPalette {
    return {
        low: readThemeToken("--brand-success", "#2F7D5D"),
        moderate: readThemeToken("--brand-warning", "#B26B00"),
        high: readThemeToken("--brand-danger", "#B23B3B"),
        primary: readThemeToken("--brand-primary", "#4D869C"),
        idle: readThemeToken("--brand-ink-muted", "#2C3F5F"),
        surface: readThemeToken("--brand-surface", "#FFFFFF"),
    };
}

function unitCaption(frame: Timeframe, metric: HeatmapMetric): string {
    if (frame.kind === "live") {
        return metric === "intensity" ? "Current draw per m²" : "Current draw in kW";
    }
    const base = frame.kind === "future" ? "Predicted daily use" : "Average daily use";
    return metric === "intensity" ? `${base} per m²` : `${base} in kWh`;
}

function formatMetric(point: HeatmapPoint, metric: HeatmapMetric): string {
    return metric === "intensity" ? formatIntensity(point.intensity) : formatEnergy(point.value, point.unit);
}

function countOf(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

function describePlacement(placed: number, failed: number): string {
    if (placed === 0) {
        return failed > 0
            ? "No address could be matched to a location. Place those buildings by hand."
            : "There was nothing left to place.";
    }
    if (failed === 0) {
        return `Placed ${countOf(placed, "building", "buildings")} from their addresses.`;
    }
    return `Placed ${countOf(placed, "building", "buildings")}. ${countOf(failed, "address", "addresses")} could not be matched.`;
}

function placementSignature(buildings: HeatmapBuilding[]): string {
    return buildings
        .map((building) => {
            const coordinates = coordinatesOf(building);
            return coordinates ? `${building.building_id}:${coordinates.latitude}:${coordinates.longitude}` : "";
        })
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
        .join("|");
}

function StageNote({ title, body, loading = false, children }: Readonly<{ title: string; body?: string; loading?: boolean; children?: ReactNode }>) {
    const inside = (
        <>
            {loading && <span className="heat-spinner" aria-hidden="true" />}
            <p className="heat-stage-title">{title}</p>
            {body && <p className="text-muted heat-stage-body">{body}</p>}
            {children}
        </>
    );

    if (loading) {
        return <output className="heat-stage-note">{inside}</output>;
    }
    return <div className="heat-stage-note">{inside}</div>;
}

function Legend({ palette, caption }: Readonly<{ palette: MapPalette | null; caption: string }>) {
    return (
        <div className="heat-legend">
            <p className="heat-legend-title">{caption}</p>
            <div className="heat-legend-bar" style={{ background: palette ? stressGradient(palette) : undefined }} />
            <div className="heat-legend-marks">
                <span>Low</span>
                <span>Moderate</span>
                <span>High</span>
            </div>
            <p className="heat-legend-note">
                <span className="heat-legend-swatch" style={{ background: palette?.idle }} aria-hidden="true" />
                {" "}
                <span>No data, scale relative to the busiest building</span>
            </p>
        </div>
    );
}

function BuildingCard({
    point,
    frame,
    metric,
    stress,
    rank,
    reporting,
    share,
    change,
    palette,
    canPlace,
    onMove,
    onClose,
}: Readonly<{
    point: HeatmapPoint;
    frame: Timeframe;
    metric: HeatmapMetric;
    stress: number | null;
    rank: number;
    reporting: number;
    share: number | null;
    change: string | null;
    palette: MapPalette | null;
    canPlace: boolean;
    onMove: () => void;
    onClose: () => void;
}>) {
    const band = stress === null ? null : stressBand(stress);
    const colour = stress !== null && palette ? stressColour(stress, palette) : undefined;
    const encoded = encodeURIComponent(point.buildingId);

    return (
        <section className="heat-card" aria-label={`${point.name} on the heatmap`}>
            <div className="heat-card-head">
                <div>
                    <p className="heat-eyebrow">{frame.label}</p>
                    <h2 className="heat-card-title">{point.name}</h2>
                    {point.type && <p className="text-muted heat-card-sub">{point.type.replace(/_/g, " ")}</p>}
                </div>
                <button type="button" className="heat-close" aria-label="Close building details" onClick={onClose}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>

            <div className="heat-card-reading">
                <span className="heat-card-value metric" style={{ color: colour }}>{formatMetric(point, metric)}</span>
                {band && <span className={`badge ${BAND_BADGES[band]}`}>{BAND_LABELS[band]}</span>}
            </div>

            <dl className="heat-card-grid">
                <div>
                    <dt>Rank</dt>
                    <dd>{metricValue(point, metric) === null ? "-" : `${rank} of ${reporting}`}</dd>
                </div>
                <div>
                    <dt>Portfolio share</dt>
                    <dd>{share === null ? "-" : `${Math.round(share * 100)}%`}</dd>
                </div>
                <div>
                    <dt>{metric === "intensity" ? "Total" : "Per m²"}</dt>
                    <dd>{metric === "intensity" ? formatEnergy(point.value, point.unit) : formatIntensity(point.intensity)}</dd>
                </div>
                <div>
                    <dt>Trend</dt>
                    <dd>{change ?? "-"}</dd>
                </div>
                {point.updatedAt && (
                    <div>
                        <dt>{frame.kind === "future" ? "Model updated" : "Data as of"}</dt>
                        <dd>{frame.kind === "live" ? formatDateTime(point.updatedAt) : formatDate(point.updatedAt)}</dd>
                    </div>
                )}
            </dl>

            <div className="heat-card-actions">
                <Link href={`/buildings/${encoded}/view#digital-twin`} className="btn btn-primary">Open 3D twin</Link>
                <Link href={`/buildings/${encoded}/view`} className="btn btn-secondary">Building details</Link>
                {canPlace && (
                    <button type="button" className="btn btn-secondary" onClick={onMove}>Move pin</button>
                )}
            </div>
        </section>
    );
}

export default function HeatmapView({ role }: Readonly<{ role: string }>) {
    const queryClient = useQueryClient();
    const searchParams = useSearchParams();
    const stageRef = useRef<HTMLDivElement>(null);
    const store = useMemo(() => createPortfolioStore(), []);
    const canPlace = role === "ADMIN" || role === "BUILDING_MANAGER";

    const initialFrame = TIMEFRAMES.findIndex((frame) => frame.id === searchParams?.get("timeframe"));
    const [index, setIndex] = useState(initialFrame >= 0 ? initialFrame : LIVE_INDEX);
    const [metric, setMetric] = useState<HeatmapMetric>("total");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hover, setHover] = useState<{ buildingId: string; x: number; y: number } | null>(null);
    const [playing, setPlaying] = useState(false);
    const [tilted, setTilted] = useState(false);
    const [bulkPlacing, setBulkPlacing] = useState<{ placed: number; failed: number } | null>(null);
    const [placement, setPlacement] = useState<Placement | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [mapFailure, setMapFailure] = useState<string | null>(null);
    const [palette, setPalette] = useState<MapPalette | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
    const [fitToken, setFitToken] = useState(0);
    const [filter, setFilter] = useState("");
    const focusedFromLink = useRef(false);

    const dark = useDarkTheme();
    const reducedMotion = useReducedMotion();
    const onScreen = useOnScreen(stageRef);
    const frame = timeframeAt(index);

    useEffect(() => {
        setPalette(readPalette());
    }, [dark]);

    const buildingsQuery = useQuery({
        queryKey: ["heatmap", "buildings"],
        queryFn: fetchBuildings,
        staleTime: 60000,
    });
    const buildings = buildingsQuery.data ?? EMPTY_BUILDINGS;
    const placedBuildings = useMemo(() => buildings.filter((building) => coordinatesOf(building) !== null), [buildings]);
    const unplacedBuildings = useMemo(() => buildings.filter((building) => coordinatesOf(building) === null), [buildings]);
    const signature = useMemo(() => placementSignature(buildings), [buildings]);

    const snapshotOptions = useCallback((frameId: TimeframeId) => {
        const target = TIMEFRAMES.find((item) => item.id === frameId) ?? TIMEFRAMES[LIVE_INDEX];
        return {
            queryKey: ["heatmap", "snapshot", frameId, signature],
            queryFn: ({ signal }: { signal: AbortSignal }) => fetchHeatmapSnapshot({ timeframe: target, buildings, signal }),
            staleTime: target.kind === "live" ? 20000 : 300000,
        };
    }, [buildings, signature]);

    const snapshotQuery = useQuery({
        ...snapshotOptions(frame.id),
        enabled: buildingsQuery.isSuccess && placedBuildings.length > 0,
        placeholderData: keepPreviousData,
        refetchInterval: frame.kind === "live" && onScreen ? 30000 : false,
        refetchOnWindowFocus: false,
        retry: 1,
    });

    const baselineQuery = useQuery({
        ...snapshotOptions(BASELINE_TIMEFRAME),
        enabled: buildingsQuery.isSuccess && placedBuildings.length > 0 && frame.kind !== "live" && frame.id !== BASELINE_TIMEFRAME,
        refetchOnWindowFocus: false,
        retry: 0,
    });

    const snapshot: HeatmapSnapshot | undefined = snapshotQuery.data;
    const showingFrame = snapshot ? timeframeAt(TIMEFRAMES.findIndex((item) => item.id === snapshot.timeframe)) : frame;

    useEffect(() => {
        if (snapshot?.timeframe !== "live") {
            return;
        }
        const receivedAt = Date.now();
        for (const point of snapshot.points) {
            if (point.value !== null) {
                store.replace(point.buildingId, point.value, receivedAt);
            }
        }
    }, [snapshot, store]);

    const { liveData, isConnected } = useTelemetryStream();
    useEffect(() => {
        if (liveData && store.ingest(liveData)) {
            setNow(Date.now());
        }
    }, [liveData, store]);

    useEffect(() => {
        if (!onScreen) {
            return;
        }
        const timer = setInterval(() => setNow(Date.now()), frame.kind === "live" ? 1000 : 30000);
        return () => clearInterval(timer);
    }, [onScreen, frame.kind]);

    const points = useMemo(() => {
        const base = snapshot?.points ?? [];
        if (showingFrame.kind !== "live") {
            return base;
        }
        const totals = store.totals(now);
        return base.map((point) => {
            const live = totals.get(point.buildingId);
            if (live === undefined) {
                return point;
            }
            return { ...point, value: live, intensity: point.areaM2 === null ? null : live / point.areaM2 };
        });
    }, [snapshot, showingFrame.kind, store, now]);

    const scale = useMemo(() => scaleOf(points, metric), [points, metric]);
    const collection = useMemo(() => toFeatureCollection(points, metric, scale), [points, metric, scale]);
    const towers = useMemo(() => toTowerCollection(points, metric, scale), [points, metric, scale]);
    const ranked = useMemo(() => rankPoints(points, metric), [points, metric]);
    const totals = useMemo(() => portfolioTotals(points, metric, showingFrame.unit), [points, metric, showingFrame.unit]);
    const changes = useMemo(() => {
        if (!baselineQuery.data || showingFrame.kind === "live" || showingFrame.id === BASELINE_TIMEFRAME) {
            return new Map<string, number>();
        }
        return changeAgainst(baselineQuery.data.points, points);
    }, [baselineQuery.data, points, showingFrame]);

    const bounds = useMemo(
        () => boundsOf(placedBuildings.map((building) => coordinatesOf(building)).filter((item): item is { latitude: number; longitude: number } => item !== null)),
        [placedBuildings],
    );
    const fitTo = useMemo(() => (bounds ? { bounds, token: fitToken } : null), [bounds, fitToken]);
    const fitKey = useRef("");
    useEffect(() => {
        if (signature && signature !== fitKey.current && !focusedFromLink.current) {
            fitKey.current = signature;
            setFitToken((token) => token + 1);
        }
    }, [signature]);

    const selected = points.find((point) => point.buildingId === selectedId) ?? null;
    const selectedRank = selected ? ranked.findIndex((point) => point.buildingId === selected.buildingId) + 1 : 0;
    const hovered = hover ? points.find((point) => point.buildingId === hover.buildingId) ?? null : null;

    const focusBuilding = useCallback((buildingId: string, reveal = false) => {
        const point = points.find((item) => item.buildingId === buildingId);
        setSelectedId(buildingId);
        if (point) {
            setFlyTo({ longitude: point.longitude, latitude: point.latitude, token: Date.now() });
        }
        if (reveal) {
            stageRef.current?.scrollIntoView?.({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
        }
    }, [points, reducedMotion]);

    useEffect(() => {
        const requested = searchParams?.get("building");
        if (!requested || focusedFromLink.current || points.length === 0) {
            return;
        }
        if (points.some((point) => point.buildingId === requested)) {
            focusedFromLink.current = true;
            focusBuilding(requested);
        }
    }, [searchParams, points, focusBuilding]);

    useEffect(() => {
        if (!playing) {
            return;
        }
        if (index >= TIMEFRAMES.length - 1) {
            setPlaying(false);
            return;
        }
        if (snapshotQuery.isFetching) {
            return;
        }
        const timer = setTimeout(() => setIndex(index + 1), PLAY_STEP_MS);
        return () => clearTimeout(timer);
    }, [playing, index, snapshotQuery.isFetching]);

    useEffect(() => {
        if (!onScreen) {
            setPlaying(false);
        }
    }, [onScreen]);

    useEffect(() => {
        if (!onScreen || placement) {
            return;
        }
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            if (event.key === "ArrowLeft" && index > 0) {
                event.preventDefault();
                setPlaying(false);
                setIndex(index - 1);
            }
            else if (event.key === "ArrowRight" && index < TIMEFRAMES.length - 1) {
                event.preventDefault();
                setPlaying(false);
                setIndex(index + 1);
            }
            else if (event.key === " ") {
                event.preventDefault();
                setPlaying((value) => (index >= TIMEFRAMES.length - 1 ? false : !value));
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onScreen, placement, index]);

    const togglePlay = () => {
        if (playing) {
            setPlaying(false);
            return;
        }
        if (index >= TIMEFRAMES.length - 1) {
            setIndex(0);
        }
        setPlaying(true);
    };

    const changeFrame = (next: number) => {
        setPlaying(false);
        setIndex(next);
    };

    const previewFrame = useCallback((next: number) => {
        const target = timeframeAt(next);
        if (target.id === frame.id || snapshot?.source !== "endpoint") {
            return;
        }
        void queryClient.prefetchQuery(snapshotOptions(target.id));
    }, [frame.id, snapshot?.source, queryClient, snapshotOptions]);

    useEffect(() => {
        if (!placement) {
            return;
        }
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setPlacement(null);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [placement]);

    const placeBuilding = useCallback(async ({ longitude, latitude }: { longitude: number; latitude: number }) => {
        if (!placement || placement.saving) {
            return;
        }
        const building = placement.building;
        const coordinates = { latitude: Number(latitude.toFixed(6)), longitude: Number(longitude.toFixed(6)) };
        setPlacement({ ...placement, saving: true, error: null });
        try {
            const response = await fetch(`/api/buildings/${encodeURIComponent(building.building_id)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(coordinates),
            });
            const payload = (await response.json().catch(() => ({}))) as { message?: string };
            if (!response.ok) {
                throw new Error(payload.message || "The pin could not be saved.");
            }
            queryClient.setQueryData<HeatmapBuilding[]>(["heatmap", "buildings"], (current) => (current ?? []).map((item) => (
                item.building_id === building.building_id ? { ...item, ...coordinates } : item
            )));
            focusedFromLink.current = true;
            setPlacement(null);
            setSelectedId(building.building_id);
            setFlyTo({ ...coordinates, token: Date.now() });
            setNotice(`${building.building_name} is now on the map.`);
        }
        catch (error) {
            setPlacement({ building, saving: false, error: error instanceof Error ? error.message : "The pin could not be saved." });
        }
    }, [placement, queryClient]);

    const placeEveryAddress = useCallback(async () => {
        let placed = 0;
        let failed = 0;
        setBulkPlacing({ placed, failed });
        try {
            for (let round = 0; round < 40; round += 1) {
                const response = await fetch("/api/heatmap/place", { method: "POST" });
                const payload = (await response.json().catch(() => ({}))) as { message?: string; data?: { placed?: number; failed?: number } };
                if (!response.ok) {
                    throw new Error(payload.message ?? "The buildings could not be placed.");
                }
                const roundPlaced = Number(payload.data?.placed) || 0;

                failed += Number(payload.data?.failed) || 0;
                placed += roundPlaced;
                setBulkPlacing({ placed, failed });
                //a round that places nothing means every address left is one the lookup cannot resolve
                if (roundPlaced === 0) {
                    break;
                }
                await queryClient.invalidateQueries({ queryKey: ["heatmap", "buildings"] });
            }
            await queryClient.invalidateQueries({ queryKey: ["heatmap", "buildings"] });
            setNotice(describePlacement(placed, failed));
        }
        catch (error) {
            setNotice(error instanceof Error ? error.message : "The buildings could not be placed.");
        }
        finally {
            setBulkPlacing(null);
        }
    }, [queryClient]);

    const handleSelect = useCallback((buildingId: string | null) => {
        setSelectedId(buildingId);
    }, []);

    const handleFailure = useCallback((message: string) => {
        setMapFailure(message);
    }, []);

    const needle = filter.trim().toLowerCase();
    const visibleRows = ranked.filter((point) => needle === "" || point.name.toLowerCase().includes(needle)).slice(0, LIST_LIMIT);
    const missingCount = snapshot?.missing.length ?? 0;

    let streamText = "Live stream connecting";
    if (isConnected) {
        streamText = store.lastReadingAt() === null ? "Live stream connected" : "Live stream receiving";
    }

    let stage: ReactNode;
    if (buildingsQuery.isLoading) {
        stage = <StageNote loading title="Loading your buildings" />;
    } else if (buildingsQuery.isError) {
        stage = (
            <StageNote title="Buildings could not be loaded" body={buildingsQuery.error instanceof Error ? buildingsQuery.error.message : undefined}>
                <button type="button" className="btn btn-secondary" onClick={() => void buildingsQuery.refetch()}>Try again</button>
            </StageNote>
        );
    } else if (mapFailure) {
        stage = <StageNote title="Map unavailable" body={`${mapFailure} The ranking below still updates for every period.`} />;
    } else {
        stage = (
            <MapCanvas
                collection={collection}
                towers={towers}
                palette={palette ?? readPalette()}
                dark={dark}
                selectedId={selectedId}
                fitTo={fitTo}
                flyTo={flyTo}
                placing={placement !== null}
                tilted={tilted}
                reducedMotion={reducedMotion}
                active={onScreen}
                onSelect={handleSelect}
                onPlace={placeBuilding}
                onHover={setHover}
                onFailure={handleFailure}
            />
        );
    }

    const hottestLabel = totals.hottest ? totals.hottest.name : "-";
    const canShowOverlay = !buildingsQuery.isLoading && !buildingsQuery.isError;

    return (
        <div className="heat">
            <PageHeading
                title="Energy heatmap"
                subtitle="See where energy is going across the portfolio, then scrub back through history or forward into the forecast."
            />

            <div className="heat-toolbar">
                <div className="heat-segment" role="radiogroup" aria-label="Measure buildings by">
                    {METRICS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={metric === option.value}
                            className={metric === option.value ? "heat-segment-option is-active" : "heat-segment-option"}
                            onClick={() => setMetric(option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setFitToken((token) => token + 1)} disabled={points.length === 0}>
                    Show all buildings
                </button>
                <button type="button" className={tilted ? "heat-toggle is-active" : "heat-toggle"} aria-pressed={tilted} disabled={points.length === 0 || Boolean(mapFailure)} onClick={() => setTilted((value) => !value)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3 21 8v8l-9 5-9-5V8z" />
                        <path d="M12 12 21 8M12 12v9M12 12 3 8" />
                    </svg>
                    Towers
                </button>
                <span className={isConnected ? "heat-stream is-live" : "heat-stream"}>
                    <span className="heat-stream-dot" aria-hidden="true" />
                    {streamText}
                </span>
            </div>

            <div className="heat-body">
                <div ref={stageRef} className={placement ? "heat-stage is-placing" : "heat-stage"}>
                    {stage}

                    {canShowOverlay && (
                        <div className="heat-overlay heat-overlay-top">
                            <fieldset className="heat-stats" aria-label="Portfolio summary for the selected period">
                                <div className="heat-stat">
                                    <span className="heat-stat-label">Portfolio</span>
                                    <span className="heat-stat-value metric">
                                        {totals.reporting > 0 ? formatEnergy(totals.total, showingFrame.unit) : "-"}
                                    </span>
                                </div>
                                <div className="heat-stat">
                                    <span className="heat-stat-label">On the map</span>
                                    <span className="heat-stat-value metric">{`${placedBuildings.length} of ${buildings.length}`}</span>
                                </div>
                                <div className="heat-stat heat-stat-wide">
                                    <span className="heat-stat-label">Hottest</span>
                                    <span className="heat-stat-value">{hottestLabel}</span>
                                </div>
                            </fieldset>
                            <Legend palette={palette} caption={unitCaption(showingFrame, metric)} />
                        </div>
                    )}

                    {hovered && hover && !selected && (
                        <div className="heat-tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }} aria-hidden="true">
                            <span className="heat-tooltip-name">{hovered.name}</span>
                            <span className="heat-tooltip-value">{formatMetric(hovered, metric)}</span>
                        </div>
                    )}

                    {selected && (
                        <BuildingCard
                            point={selected}
                            frame={showingFrame}
                            metric={metric}
                            stress={stressOf(selected, metric, scale)}
                            rank={selectedRank}
                            reporting={totals.reporting}
                            share={selected.value !== null && totals.total > 0 ? selected.value / totals.total : null}
                            change={formatChange(changes.get(selected.buildingId))}
                            palette={palette}
                            canPlace={canPlace}
                            onMove={() => {
                                const building = buildings.find((item) => item.building_id === selected.buildingId);
                                if (building) {
                                    setSelectedId(null);
                                    setPlacement({ building, saving: false, error: null });
                                }
                            }}
                            onClose={() => setSelectedId(null)}
                        />
                    )}

                    {placement && (
                        <output className="heat-placing">
                            <p>
                                {placement.saving
                                    ? `Saving the pin for ${placement.building.building_name}...`
                                    : `Click the map where ${placement.building.building_name} stands.`}
                            </p>
                            {placement.error && <p className="heat-placing-error">{placement.error}</p>}
                            <button type="button" className="btn btn-secondary" onClick={() => setPlacement(null)}>Cancel</button>
                        </output>
                    )}

                    {canShowOverlay && !mapFailure && placedBuildings.length === 0 && !placement && buildings.length > 0 && (
                        <div className="heat-empty">
                            <p className="heat-stage-title">None of your buildings are on the map yet</p>
                            <p className="text-muted">
                                {canPlace
                                    ? "Choose Place on a building in the list, then click where it stands."
                                    : "Ask an administrator or building manager to place your buildings."}
                            </p>
                        </div>
                    )}

                    {canShowOverlay && (
                        <div className="heat-overlay heat-overlay-bottom">
                            <TimelineScrubber
                                index={index}
                                now={now}
                                playing={playing}
                                busy={snapshotQuery.isFetching && placedBuildings.length > 0}
                                onChange={changeFrame}
                                onTogglePlay={togglePlay}
                                onPreview={previewFrame}
                            />
                        </div>
                    )}
                </div>

                <aside className="heat-panel" aria-label="Buildings ranked for the selected period">
                    <div className="heat-panel-header">
                        <h2 className="heat-panel-title">{showingFrame.kind === "future" ? "Predicted hotspots" : "Hotspots"}</h2>
                        <span className="heat-panel-meta">{showingFrame.label}</span>
                    </div>

                    {notice && (
                        <output className="heat-notice">
                            {notice}
                            <button type="button" className="heat-notice-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                                    <path d="M6 6l12 12M18 6L6 18" />
                                </svg>
                            </button>
                        </output>
                    )}

                    {snapshotQuery.isError && (
                        <p className="heat-warning" role="alert">This period could not be loaded. The map shows the last good data.</p>
                    )}

                    {ranked.length > 8 && (
                        <input
                            type="search"
                            className="input heat-filter"
                            placeholder="Filter buildings by name"
                            aria-label="Filter buildings"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                        />
                    )}

                    {visibleRows.length > 0 && (
                        <ol className="heat-list">
                            {visibleRows.map((point) => {
                                const stress = stressOf(point, metric, scale);
                                const colour = stress !== null && palette ? stressColour(stress, palette) : palette?.idle;
                                const change = formatChange(changes.get(point.buildingId));
                                const reading = metricValue(point, metric);
                                const share = reading !== null && scale.peak > 0 ? Math.max(0.03, reading / scale.peak) : 0;
                                return (
                                    <li key={point.buildingId}>
                                        <button
                                            type="button"
                                            className={point.buildingId === selectedId ? "heat-row is-selected" : "heat-row"}
                                            aria-pressed={point.buildingId === selectedId}
                                            onClick={() => focusBuilding(point.buildingId, true)}
                                        >
                                            <span className="heat-row-swatch" style={{ background: colour }} aria-hidden="true" />
                                            <span className="heat-row-main">
                                                <span className="heat-row-name">{point.name}</span>
                                                <span className="heat-row-meta">{change ?? (point.type ? point.type.replace(/_/g, " ") : "Building")}</span>
                                                <span className="heat-row-track" aria-hidden="true">
                                                    <span className="heat-row-fill" style={{ width: `${Math.round(share * 100)}%`, background: colour }} />
                                                </span>
                                            </span>
                                            <span className="heat-row-value metric">{metricValue(point, metric) === null ? "No data" : formatMetric(point, metric)}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    )}

                    {!buildingsQuery.isLoading && placedBuildings.length > 0 && visibleRows.length === 0 && (
                        <p className="text-muted heat-panel-message">No buildings match that filter.</p>
                    )}

                    {missingCount > 0 && placedBuildings.length > 0 && (
                        <p className="text-muted heat-panel-footnote">
                            {missingCount === 1 ? "1 building has" : `${missingCount} buildings have`} no data for this period.
                        </p>
                    )}

                    {unplacedBuildings.length > 0 && (
                        <div className="heat-unplaced">
                            <h3 className="heat-unplaced-title">Not on the map ({unplacedBuildings.length})</h3>
                            <p className="text-muted heat-unplaced-note">
                                {canPlace
                                    ? "These buildings have no coordinates yet. Look them up from their street address or place any one by hand."
                                    : "These buildings have no coordinates yet."}
                            </p>
                            {canPlace && (
                                <div className="heat-bulk">
                                    <button
                                        type="button"
                                        className="btn btn-primary heat-bulk-action"
                                        disabled={bulkPlacing !== null || Boolean(mapFailure)}
                                        onClick={() => void placeEveryAddress()}
                                    >
                                        {bulkPlacing ? "Looking up addresses..." : "Place from address"}
                                    </button>
                                    {bulkPlacing && (
                                        <output className="heat-bulk-progress">
                                            {`${bulkPlacing.placed} placed`}
                                            {bulkPlacing.failed > 0 ? `, ${bulkPlacing.failed} not matched` : ""}
                                        </output>
                                    )}
                                </div>
                            )}
                            <ul className="heat-unplaced-list">
                                {unplacedBuildings.map((building) => (
                                    <li key={building.building_id}>
                                        <span className="heat-unplaced-name">{building.building_name}</span>
                                        {canPlace && (
                                            <button
                                                type="button"
                                                className="heat-place"
                                                aria-pressed={placement?.building.building_id === building.building_id}
                                                disabled={Boolean(mapFailure)}
                                                onClick={() => {
                                                    setSelectedId(null);
                                                    setPlacement({ building, saving: false, error: null });
                                                }}
                                            >
                                                Place
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}