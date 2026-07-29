import { useState, useEffect } from "react";

export type TelemetryData = {
    building_id: string;
    sensor_id: string;
    source_type?: string;
    voltage_v?: number;
    current_a?: number;
    power_kw?: number;
    timestamp: string;
};

export function useTelemetryStream(buildingId?: string) {
    const [liveData, setLiveData] = useState<TelemetryData | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);

    useEffect(() => {
        const targetId = buildingId ? encodeURIComponent(buildingId) : "portfolio";
        
        const url = `/api/telemetry/stream/${targetId}`;

        const eventSource = new EventSource(url);

        eventSource.onopen = () => {
            setIsConnected(true);
            setError(null);
        };

        eventSource.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                setLiveData(parsed);
            } catch (err) {
                console.error("Failed to parse telemetry event data:", err);
            }
        };

        eventSource.onerror = () => {
            setIsConnected(false);
            setError(new Error("Lost connection to telemetry stream."));
            eventSource.close();
        };

        return () => {
            eventSource.close();
            setIsConnected(false);
        };
    }, [buildingId]);

    return { liveData, error, isConnected };
}