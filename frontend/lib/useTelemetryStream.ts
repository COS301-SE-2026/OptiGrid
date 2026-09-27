import { useState, useEffect, useRef } from "react";
import { getTabSessionPath } from "./tab-session";

export type TelemetryData = {
    building_id: string;
    sensor_id: string;
    source_type?: string;
    voltage_v?: number;
    current_a?: number;
    power_kw?: number;
    timestamp: string;
};

type StreamStatus = "connecting" | "open" | "closed";

type Subscriber = {
    onReading: (reading: TelemetryData) => void;
    onStatus: (status: StreamStatus) => void;
};

type SharedStream = {
    url: string;
    source: EventSource | null;
    status: StreamStatus;
    subscribers: Set<Subscriber>;
    retries: number;
    retryTimer: ReturnType<typeof setTimeout> | null;
};

type TelemetryStreamOptions = {
    onReading?: (reading: TelemetryData) => void;
    trackLatest?: boolean;
};

const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;
const streams = new Map<string, SharedStream>();

function parseReadings(raw: string): TelemetryData[] {
    const parsed: unknown = JSON.parse(raw);
    const dataItems = Array.isArray(parsed) ? parsed : [parsed];
    return dataItems.filter((item): item is TelemetryData => typeof item === "object" && item !== null);
}

function updateStatus(stream: SharedStream, status: StreamStatus) {
    stream.status = status;
    stream.subscribers.forEach((subscriber) => subscriber.onStatus(status));
}

function scheduleRetry(stream: SharedStream) {
    if (stream.retryTimer || stream.subscribers.size === 0) {
        return;
    }
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** stream.retries);
    stream.retries += 1;
    stream.retryTimer = setTimeout(() => {
        stream.retryTimer = null;
        if (stream.subscribers.size > 0) {
            openStream(stream);
        }
    }, delay);
}

function openStream(stream: SharedStream) {
    const source = new EventSource(stream.url);
    stream.source = source;
    updateStatus(stream, "connecting");

    source.onopen = () => {
        stream.retries = 0;
        updateStatus(stream, "open");
    };

    source.onmessage = (event) => {
        let readings: TelemetryData[];
        try {
            readings = parseReadings(event.data);
        } catch (err) {
            console.error("Failed to parse telemetry event data:", err);
            return;
        }
        stream.subscribers.forEach((subscriber) => {
            readings.forEach((reading) => subscriber.onReading(reading));
        });
    };

    source.onerror = () => {
        source.close();
        stream.source = null;
        updateStatus(stream, "closed");
        scheduleRetry(stream);
    };
}

function subscribe(url: string, subscriber: Subscriber): () => void {
    let stream = streams.get(url);
    if (!stream) {
        stream = { url, source: null, status: "connecting", subscribers: new Set(), retries: 0, retryTimer: null };
        streams.set(url, stream);
        openStream(stream);
    }
    const active = stream;
    active.subscribers.add(subscriber);
    subscriber.onStatus(active.status);

    return () => {
        active.subscribers.delete(subscriber);
        if (active.subscribers.size > 0) {
            return;
        }
        if (active.retryTimer) {
            clearTimeout(active.retryTimer);
        }
        active.source?.close();
        streams.delete(url);
    };
}

export function useTelemetryStream(buildingId?: string, options: TelemetryStreamOptions = {}) {
    const [liveData, setLiveData] = useState<TelemetryData | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const onReadingRef = useRef(options.onReading);
    const trackLatest = options.trackLatest ?? true;

    useEffect(() => {
        onReadingRef.current = options.onReading;
    }, [options.onReading]);

    useEffect(() => {
        setLiveData(null);
        setError(null);
        setIsConnected(false);

        if (buildingId === "") {
            return;
        }

        const targetId = buildingId ? encodeURIComponent(buildingId) : "portfolio";

        return subscribe(getTabSessionPath(`/api/telemetry/stream/${targetId}`), {
            onReading: (reading) => {
                if (trackLatest) {
                    setLiveData(reading);
                }
                onReadingRef.current?.(reading);
            },
            onStatus: (status) => {
                setIsConnected(status === "open");
                if (status === "open") {
                    setError(null);
                }
                if (status === "closed") {
                    setError(new Error("Lost connection to telemetry stream."));
                }
            },
        });
    }, [buildingId, trackLatest]);

    return { liveData, error, isConnected };
}