"use client";

import { useEffect, useState } from "react";

type TelemetryData = {
    building_id: string;
    sensor_id: string;
    source_type: string;
    voltage_v: number;
    current_a: number;
    power_kw: number;
    timestamp: string;
};

export function useTelemetryStream(buildingId: string) {
    const [liveData, setLiveData] = useState<TelemetryData | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!buildingId) return;

        const API_BASE = process.env.NEXT_PUBLIC_CORE_API_URL || "http://localhost:4000";
        const eventSource = new EventSource(`${API_BASE}/api/telemetry/stream/${buildingId}`);

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLiveData(data);
            } catch (err) {
                console.error("Failed to parse SSE telemetry:", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("SSE Connection Error:", err);
            setError(new Error("Lost connection to telemetry stream."));
            setIsConnected(false);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, [buildingId]);

    return { liveData, error, isConnected };
}