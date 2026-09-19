"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTelemetryStream, type TelemetryData } from "@/lib/useTelemetryStream";
import {
    STALE_AFTER_MS,
    buildTwinLayout,
    createReadingStore,
    describeSensor,
    formatAge,
    formatKw,
    resolveLimits,
    stressColour,
    stressGradient,
    summariseSensors,
    type IncomingReading,
    type LoadLens,
    type SensorState,
    type SensorView,
    type StressBand,
    type TwinBuilding,
    type TwinLimits,
    type TwinSensor,
} from "@/lib/digitalTwin";
import type { ScenePalette } from "./TwinScene";

const TwinScene = dynamic(() => import("./TwinScene"), {
    ssr: false,
    loading: () => <StageMessage loading title="Preparing the 3D view" />,
});

type SensorListPayload = {
    data?: TwinSensor[];
    message?: string;
};

type SnapshotPayload = {
    data?: IncomingReading[];
};

type Snapshot = {
    supported: boolean;
    rows: IncomingReading[];
};

const NO_SENSORS: TwinSensor[] = [];
const LIST_LIMIT = 60;
const SNAPSHOT_POLL_MS = 15000;
const HUD_REFRESH_MS = 250;

const LENS_OPTIONS: Array<{ value: LoadLens; label: string; hint: string }> = [
    { value: "circuit", label: "Circuit load", hint: "Current draw compared with the building circuit limit" },
    { value: "deviation", label: "Deviation", hint: "Live draw compared with each sensor's recent normal" },
];

const STATE_LABELS: Record<SensorState, string> = {
    live: "Live",
    stale: "Signal lost",
    waiting: "Waiting for data",
    offline: "Offline",
    maintenance: "Maintenance",
};

const BAND_LABELS: Record<StressBand, string> = {
    normal: "Normal",
    elevated: "Elevated",
    critical: "Critical",
};

const BAND_BADGES: Record<StressBand, string> = {
    normal: "badge-success",
    elevated: "badge-warning",
    critical: "badge-danger",
};

async function fetchSensors(buildingId: string): Promise<TwinSensor[]> {
    const response = await fetch(`/api/sensors?building_id=${encodeURIComponent(buildingId)}`, {
        method: "GET",
        cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as SensorListPayload;
    if (!response.ok) {
        throw new Error(payload.message || "Unable to load the sensors for this building.");
    }
    return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchSnapshot(buildingId: string): Promise<Snapshot> {
    try {
        const response = await fetch(`/api/buildings/${encodeURIComponent(buildingId)}/sensors/live`, {
            method: "GET",
            cache: "no-store",
        });
        if (response.status === 404 || response.status === 405 || response.status === 501) {
            return { supported: false, rows: [] };
        }
        if (!response.ok) {
            return { supported: true, rows: [] };
        }
        const payload = (await response.json().catch(() => ({}))) as SnapshotPayload;
        return { supported: true, rows: Array.isArray(payload.data) ? payload.data : [] };
    } catch {
        return { supported: true, rows: [] };
    }
}

function readPalette(): ScenePalette {
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return {
        normal: token("--brand-success", "#2F7D5D"),
        elevated: token("--brand-warning", "#B26B00"),
        critical: token("--brand-danger", "#B23B3B"),
        idle: token("--brand-ink-muted", "#2C3F5F"),
        primary: token("--brand-primary", "#4D869C"),
        secondary: token("--brand-secondary", "#7AB2B2"),
        surface: token("--brand-surface", "#FFFFFF"),
        surfaceAlt: token("--brand-surface-alt", "#CDE8E5"),
        ink: token("--brand-ink", "#0B1120"),
        background: token("--brand-bg", "#EEF7FF"),
    };
}

function supportsWebGL(): boolean {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

function useDarkTheme(): boolean {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const root = document.documentElement;
        const read = () => setDark(root.classList.contains("dark") || root.dataset.theme === "dark");
        read();
        const observer = new MutationObserver(read);
        observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
        return () => observer.disconnect();
    }, []);
    return dark;
}

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== "function") {
            return;
        }
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(query.matches);
        const update = (event: MediaQueryListEvent) => setReduced(event.matches);
        query.addEventListener?.("change", update);
        return () => query.removeEventListener?.("change", update);
    }, []);
    return reduced;
}

function useOnScreen(ref: RefObject<HTMLElement | null>): boolean {
    const [inView, setInView] = useState(true);
    const [pageVisible, setPageVisible] = useState(true);

    useEffect(() => {
        const element = ref.current;
        if (!element || typeof IntersectionObserver === "undefined") {
            return;
        }
        const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);

    useEffect(() => {
        const update = () => setPageVisible(document.visibilityState !== "hidden");
        update();
        document.addEventListener("visibilitychange", update);
        return () => document.removeEventListener("visibilitychange", update);
    }, []);

    return inView && pageVisible;
}

function viewColour(view: SensorView, palette: ScenePalette | null): string | undefined {
    if (!palette) {
        return undefined;
    }
    if (view.state !== "live") {
        return palette.idle;
    }
    return view.stress === null ? palette.primary : stressColour(view.stress, palette);
}

function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function deviationText(view: SensorView): string {
    if (view.deviation === null) {
        return view.state === "live" ? "Learning normal" : "-";
    }
    const drift = view.deviation - 1;
    if (Math.abs(drift) < 0.05) {
        return "In line with normal";
    }
    return `${formatPercent(Math.abs(drift))} ${drift > 0 ? "above" : "below"} normal`;
}

function circuitText(view: SensorView, limits: TwinLimits): string {
    return view.loadShare === null ? "-" : `${formatPercent(view.loadShare)} of ${limits.limitAmps} A`;
}

function rowDetail(view: SensorView, lens: LoadLens, limits: TwinLimits): string {
    if (view.state !== "live") {
        return view.sensor.sensor_type?.trim() || "No live reading";
    }
    const measure = lens === "circuit" ? circuitText(view, limits) : deviationText(view);
    return view.band ? `${BAND_LABELS[view.band]}, ${measure}` : measure;
}

function matchesFilter(view: SensorView, filter: string): boolean {
    if (filter === "") {
        return true;
    }
    return [view.label, view.sensor.sensor_type, view.sensor.mac_address]
        .some((value) => value?.toLowerCase().includes(filter));
}

function StageMessage({
    title,
    body,
    action,
    loading = false,
}: Readonly<{ title: string; body?: string; action?: ReactNode; loading?: boolean }>) {
    return (
        <div className="twin-stage-message" role={loading ? "status" : undefined}>
            {loading && <span className="twin-spinner" aria-hidden="true" />}
            <p className="twin-stage-title">{title}</p>
            {body && <p className="text-muted twin-stage-body">{body}</p>}
            {action}
        </div>
    );
}

function Stat({ label, value, tone }: Readonly<{ label: string; value: string; tone?: StressBand }>) {
    return (
        <div className={tone ? `twin-stat twin-stat-${tone}` : "twin-stat"}>
            <span className="twin-stat-label">{label}</span>
            <span className="twin-stat-value metric">{value}</span>
        </div>
    );
}

function markClass(at: number): string | undefined {
    if (at === 0) {
        return "is-start";
    }
    return at >= 85 ? "is-end" : undefined;
}

function Legend({ lens, palette, limitAmps }: Readonly<{ lens: LoadLens; palette: ScenePalette | null; limitAmps: number }>) {
    const marks = lens === "circuit"
        ? [
            { at: 0, text: "0%" },
            { at: 60, text: "60%" },
            { at: 88, text: "85%" },
        ]
        : [
            { at: 0, text: "Typical" },
            { at: 60, text: "30% off" },
            { at: 88, text: "50% off" },
        ];

    return (
        <div className="twin-legend">
            <p className="twin-legend-title">{lens === "circuit" ? `Share of the ${limitAmps} A circuit limit` : "Drift from normal draw"}</p>
            <div className="twin-legend-bar" style={{ background: palette ? stressGradient(palette) : undefined }} />
            <div className="twin-legend-marks">
                {marks.map((mark) => (
                    <span
                        key={mark.text}
                        className={markClass(mark.at)}
                        style={{ left: `${mark.at}%` }}
                    >
                        {mark.text}
                    </span>
                ))}
            </div>
            <p className="twin-legend-idle">
                <span className="twin-legend-swatch" style={{ background: palette?.idle }} aria-hidden="true" />
                No live signal
            </p>
        </div>
    );
}

function Sparkline({ values, colour }: Readonly<{ values: number[]; colour?: string }>) {
    if (values.length < 2) {
        return <p className="text-muted twin-spark-empty">The trend appears after a few readings.</p>;
    }
    const width = 240;
    const height = 48;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const points = values
        .map((value, index) => {
            const x = (index / (values.length - 1)) * width;
            const y = height - 4 - ((value - min) / span) * (height - 8);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

    return (
        <svg
            className="twin-spark"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Recent draw between ${formatKw(min)} and ${formatKw(max)}`}
        >
            <polyline
                points={points}
                fill="none"
                stroke={colour ?? "currentColor"}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

function Inspector({
    view,
    limits,
    palette,
    now,
    onClose,
}: Readonly<{ view: SensorView; limits: TwinLimits; palette: ScenePalette | null; now: number; onClose: () => void }>) {
    const colour = viewColour(view, palette);
    const subtitle = [view.sensor.sensor_type, view.sensor.mac_address].filter(Boolean).join(", ");
    const live = view.state === "live";

    return (
        <section className="twin-inspector" aria-label={`${view.label} details`}>
            <div className="twin-inspector-head">
                <div>
                    <p className="twin-eyebrow">Selected sensor</p>
                    <h3 className="twin-inspector-title">{view.label}</h3>
                    {subtitle && <p className="text-muted twin-inspector-sub">{subtitle}</p>}
                </div>
                <button type="button" className="twin-close" aria-label="Close sensor details" onClick={onClose}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                </button>
            </div>
            <div className="twin-inspector-reading">
                <span className="twin-inspector-power metric" style={{ color: live ? colour : undefined }}>
                    {live ? formatKw(view.powerKw) : STATE_LABELS[view.state]}
                </span>
                {view.band && <span className={`badge ${BAND_BADGES[view.band]}`}>{BAND_LABELS[view.band]}</span>}
            </div>
            <Sparkline values={view.history} colour={colour} />
            <dl className="twin-inspector-grid">
                <div>
                    <dt>Current</dt>
                    <dd className="metric">{view.currentA === null ? "-" : `${view.currentA.toFixed(1)} A`}</dd>
                </div>
                <div>
                    <dt>Voltage</dt>
                    <dd className="metric">{view.voltageV === null ? "-" : `${view.voltageV.toFixed(1)} V`}</dd>
                </div>
                <div>
                    <dt>Circuit limit</dt>
                    <dd>{circuitText(view, limits)}</dd>
                </div>
                <div>
                    <dt>Versus normal</dt>
                    <dd>{deviationText(view)}</dd>
                </div>
                <div>
                    <dt>Zone</dt>
                    <dd>{view.sensor.location_zone?.trim() || "Not set"}</dd>
                </div>
                <div>
                    <dt>Last reading</dt>
                    <dd>{formatAge(view.lastSeenAt, now)}</dd>
                </div>
            </dl>
        </section>
    );
}

function SensorRow({
    view,
    lens,
    limits,
    palette,
    selected,
    onToggle,
}: Readonly<{
    view: SensorView;
    lens: LoadLens;
    limits: TwinLimits;
    palette: ScenePalette | null;
    selected: boolean;
    onToggle: (sensorId: string) => void;
}>) {
    const colour = viewColour(view, palette);
    const live = view.state === "live";
    return (
        <li>
            <button
                type="button"
                className={selected ? "twin-row is-selected" : "twin-row"}
                aria-pressed={selected}
                onClick={() => onToggle(view.sensor.sensor_id)}
            >
                <span className="twin-row-swatch" style={{ background: colour }} aria-hidden="true" />
                <span className="twin-row-main">
                    <span className="twin-row-name">{view.label}</span>
                    <span className="twin-row-meta">{rowDetail(view, lens, limits)}</span>
                </span>
                <span className="twin-row-value">
                    <span className={live ? "twin-row-power metric" : "twin-row-power is-idle"}>
                        {live ? formatKw(view.powerKw) : STATE_LABELS[view.state]}
                    </span>
                    {live && (
                        <span className="twin-row-bar" aria-hidden="true">
                            <span style={{ width: `${Math.round((view.stress ?? 0) * 100)}%`, background: colour }} />
                        </span>
                    )}
                </span>
            </button>
        </li>
    );
}

function DigitalTwin({ building }: Readonly<{ building: TwinBuilding }>) {
    const buildingId = building.building_id;
    const headingId = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const store = useMemo(() => createReadingStore(buildingId), [buildingId]);
    const limits = useMemo(() => resolveLimits(building), [building]);

    const [lens, setLens] = useState<LoadLens>("circuit");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [filter, setFilter] = useState("");
    const [now, setNow] = useState(() => Date.now());
    const [streamQuiet, setStreamQuiet] = useState(true);
    const [resetToken, setResetToken] = useState(0);
    const [sceneKey, setSceneKey] = useState(0);
    const [contextLost, setContextLost] = useState(false);
    const [webgl, setWebgl] = useState<boolean | null>(null);
    const [palette, setPalette] = useState<ScenePalette | null>(null);

    const dark = useDarkTheme();
    const reducedMotion = useReducedMotion();
    const onScreen = useOnScreen(stageRef);

    useEffect(() => {
        setWebgl(supportsWebGL());
    }, []);

    useEffect(() => {
        setPalette(readPalette());
    }, [dark]);

    useEffect(() => {
        if (window.location.hash === "#digital-twin") {
            sectionRef.current?.scrollIntoView?.({ block: "start" });
        }
    }, []);

    useEffect(() => {
        if (!expanded) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setExpanded(false);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [expanded]);

    const sensorsQuery = useQuery({
        queryKey: ["digital-twin", "sensors", buildingId],
        queryFn: () => fetchSensors(buildingId),
        enabled: buildingId !== "",
        staleTime: 60000,
    });
    const sensors = sensorsQuery.data ?? NO_SENSORS;
    const layout = useMemo(() => buildTwinLayout(building, sensors), [building, sensors]);

    const snapshotQuery = useQuery({
        queryKey: ["digital-twin", "snapshot", buildingId],
        queryFn: () => fetchSnapshot(buildingId),
        enabled: buildingId !== "",
        retry: false,
        refetchOnWindowFocus: false,
        refetchInterval: (query) => (query.state.data?.supported === false || !streamQuiet || !onScreen ? false : SNAPSHOT_POLL_MS),
    });

    useEffect(() => {
        const rows = snapshotQuery.data?.rows ?? [];
        const receivedAt = Date.now();
        rows.forEach((row) => store.ingest(row, { source: "snapshot", receivedAt }));
    }, [snapshotQuery.data, store]);

    const ingest = useCallback((reading: TelemetryData) => {
        store.ingest(reading);
    }, [store]);
    const { isConnected, error: streamError } = useTelemetryStream(buildingId, { onReading: ingest, trackLatest: false });

    useEffect(() => {
        if (!onScreen) {
            return;
        }
        let pending: ReturnType<typeof setTimeout> | null = null;
        const tick = () => {
            const time = Date.now();
            const lastStream = store.lastStreamAt();
            setNow(time);
            setStreamQuiet(lastStream === null || time - lastStream > STALE_AFTER_MS);
        };
        const soon = () => {
            if (pending === null) {
                pending = setTimeout(() => {
                    pending = null;
                    tick();
                }, HUD_REFRESH_MS);
            }
        };
        tick();
        const timer = setInterval(tick, 1000);
        const unsubscribe = store.subscribe(soon);
        return () => {
            clearInterval(timer);
            if (pending !== null) {
                clearTimeout(pending);
            }
            unsubscribe();
        };
    }, [store, onScreen]);

    const views = useMemo(
        () => layout.placements.map((placement) => describeSensor(
            placement.sensor,
            store.get(placement.sensor.sensor_id),
            lens,
            limits,
            now,
        )),
        [layout, store, lens, limits, now],
    );
    const summary = useMemo(() => summariseSensors(views), [views]);
    const selected = summary.rows.find((row) => row.sensor.sensor_id === selectedId) ?? null;
    const needle = filter.trim().toLowerCase();
    const matchingRows = summary.rows.filter((row) => matchesFilter(row, needle));
    const shownRows = matchingRows.slice(0, LIST_LIMIT);

    const handleSelect = useCallback((sensorId: string | null) => {
        setSelectedId(sensorId);
    }, []);
    const toggleSensor = useCallback((sensorId: string) => {
        setSelectedId((current) => (current === sensorId ? null : sensorId));
    }, []);
    const handleContextLost = useCallback(() => {
        setContextLost(true);
    }, []);

    const resetView = () => {
        setSelectedId(null);
        setResetToken((token) => token + 1);
    };
    const restartScene = () => {
        setContextLost(false);
        setSceneKey((key) => key + 1);
    };

    const sensorCount = layout.placements.length;
    const attention = summary.critical + summary.elevated;
    let attentionTone: StressBand | undefined;
    if (summary.critical > 0) {
        attentionTone = "critical";
    } else if (summary.elevated > 0) {
        attentionTone = "elevated";
    }

    let streamTone = "idle";
    let streamText = "Connecting";
    if (summary.reporting > 0 && (isConnected || !streamQuiet)) {
        streamTone = "live";
        streamText = "Live";
    } else if (isConnected) {
        streamText = "Awaiting readings";
    } else if (streamError) {
        streamTone = "warn";
        streamText = "Reconnecting";
    }

    const buildingName = building.building_name?.trim() || "this building";
    const stageLabel = `3D model of ${buildingName} across ${layout.floors} floor${layout.floors === 1 ? "" : "s"} with ${sensorCount} sensor${sensorCount === 1 ? "" : "s"}. ${summary.reporting} reporting, ${formatKw(summary.reporting > 0 ? summary.totalKw : null)} live load. Use the sensor list to inspect each sensor.`;

    let stage: ReactNode;
    if (webgl === false) {
        stage = (
            <StageMessage
                title="3D view unavailable"
                body="This browser or device cannot draw WebGL graphics. Live readings for every sensor are still listed alongside."
            />
        );
    } else if (contextLost) {
        stage = (
            <StageMessage
                title="3D view paused"
                body="The browser reclaimed graphics memory for this page."
                action={<button type="button" className="btn btn-secondary" onClick={restartScene}>Restart 3D view</button>}
            />
        );
    } else if (webgl === null || palette === null) {
        stage = <StageMessage loading title="Preparing the 3D view" />;
    } else {
        stage = (
            <div className="twin-canvas-wrap" role="img" aria-label={stageLabel}>
                <TwinScene
                    key={sceneKey}
                    layout={layout}
                    store={store}
                    lens={lens}
                    limits={limits}
                    palette={palette}
                    dark={dark}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                    active={onScreen}
                    reducedMotion={reducedMotion}
                    resetToken={resetToken}
                    onContextLost={handleContextLost}
                />
            </div>
        );
    }

    let panel: ReactNode;
    if (sensorsQuery.isLoading) {
        panel = (
            <div className="twin-list-loading" role="status" aria-label="Loading sensors">
                <div className="skeleton" />
                <div className="skeleton" />
                <div className="skeleton" />
            </div>
        );
    } else if (sensorsQuery.isError) {
        panel = (
            <div className="twin-panel-message" role="alert">
                <p>{sensorsQuery.error instanceof Error ? sensorsQuery.error.message : "Unable to load the sensors for this building."}</p>
                <button type="button" className="btn btn-secondary" onClick={() => void sensorsQuery.refetch()}>Try again</button>
            </div>
        );
    } else if (sensorCount === 0) {
        panel = (
            <div className="twin-panel-message">
                <p>No sensors are registered for this building yet. Once a sensor is registered it appears in the model and lights up with its live load.</p>
                <Link href={`/buildings/${encodeURIComponent(buildingId)}/sensors`} className="btn btn-secondary">Manage sensors</Link>
            </div>
        );
    } else {
        panel = (
            <>
                {shownRows.length === 0 ? (
                    <p className="text-muted twin-panel-message">No sensors match that filter.</p>
                ) : (
                    <ul className="twin-list">
                        {shownRows.map((view) => (
                            <SensorRow
                                key={view.sensor.sensor_id}
                                view={view}
                                lens={lens}
                                limits={limits}
                                palette={palette}
                                selected={view.sensor.sensor_id === selectedId}
                                onToggle={toggleSensor}
                            />
                        ))}
                    </ul>
                )}
                {matchingRows.length > LIST_LIMIT && (
                    <p className="text-muted twin-list-note">
                        Showing the {LIST_LIMIT} busiest of {matchingRows.length} sensors. Filter to find the rest.
                    </p>
                )}
            </>
        );
    }

    return (
        <section
            id="digital-twin"
            ref={sectionRef}
            className={expanded ? "card twin twin-expanded" : "card twin"}
            aria-labelledby={headingId}
        >
            <header className="twin-header">
                <div>
                    <p className="twin-eyebrow">Digital twin</p>
                    <h2 id={headingId} className="twin-title">{building.building_name?.trim() || "Building"} in 3D</h2>
                    <p className="text-muted twin-subtitle">
                        Each sensor sits in its zone and glows with its live load. Power flows in from the grid as readings arrive.
                    </p>
                </div>
                <div className="twin-actions">
                    <div className="twin-lens" role="radiogroup" aria-label="Colour sensors by">
                        {LENS_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={lens === option.value}
                                title={option.hint}
                                className={lens === option.value ? "twin-lens-option is-active" : "twin-lens-option"}
                                onClick={() => setLens(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={resetView}>Reset view</button>
                    <button type="button" className="btn btn-primary" aria-pressed={expanded} onClick={() => setExpanded((value) => !value)}>
                        {expanded ? "Exit full view" : "Full view"}
                    </button>
                </div>
            </header>

            <div className="twin-body">
                <div ref={stageRef} className="twin-stage">
                    {stage}
                    <div className="twin-overlay twin-overlay-top">
                        <div className="twin-stats" role="group" aria-label="Live building summary">
                            <Stat label="Live load" value={formatKw(summary.reporting > 0 ? summary.totalKw : null)} />
                            <Stat label="Reporting" value={`${summary.reporting} of ${sensorCount}`} />
                            <Stat label="Need attention" value={String(attention)} tone={attentionTone} />
                        </div>
                        <span className={`twin-stream twin-stream-${streamTone}`}>
                            <span className="twin-stream-dot" aria-hidden="true" />
                            {streamText}
                        </span>
                    </div>
                    {selected && (
                        <Inspector view={selected} limits={limits} palette={palette} now={now} onClose={() => setSelectedId(null)} />
                    )}
                    <div className="twin-overlay twin-overlay-bottom">
                        <Legend lens={lens} palette={palette} limitAmps={limits.limitAmps} />
                        <p className="twin-hint" aria-hidden="true">Drag to orbit, scroll to zoom, select a sensor to inspect it</p>
                    </div>
                </div>

                <aside className="twin-panel" aria-label="Sensors in the model">
                    <div className="twin-panel-header">
                        <h3 className="twin-panel-title">Sensors</h3>
                        <span className="twin-panel-meta">
                            {summary.peak ? `Busiest: ${summary.peak.label}` : formatAge(summary.lastSeenAt, now)}
                        </span>
                    </div>
                    {sensorCount > 6 && (
                        <input
                            type="search"
                            className="input twin-filter"
                            placeholder="Filter by zone, type or MAC"
                            aria-label="Filter sensors"
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                        />
                    )}
                    {panel}
                </aside>
            </div>
        </section>
    );
}

export default memo(DigitalTwin);