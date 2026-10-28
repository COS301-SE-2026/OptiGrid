import { useState, useEffect } from "react";
import type { Anomaly } from "@/components/sharedanomaly";
import { getTabSessionPath } from "./tab-session";
import { useDisplayPreferences } from "./useDisplayPreferences";

const TOAST_MS = 5000;
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 30000;

type AlertMessage = { event?: string; payload?: Anomaly };

export function useAnomalyAlerts() {
  const [latestAnomaly, setLatestAnomaly] = useState<Anomaly | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { liveUpdates } = useDisplayPreferences();
  // data saver keeps alerts and Paused turns them off
  const listening = liveUpdates !== "paused";

  useEffect(() => {
    if (!listening) {
      return;
    }

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    let retries = 0;
    let stopped = false;

    const connect = () => {
      source = new EventSource(getTabSessionPath("/api/anomalies/stream"), { withCredentials: true });

      source.onopen = () => {
        retries = 0;
      };

      source.onmessage = (event) => {
        let message: AlertMessage;
        try {
          message = JSON.parse(event.data);
        } catch (err) {
          console.error("Failed to parse anomaly alert:", err);
          return;
        }
        if (message?.event !== "ANOMALY_DETECTED" || !message.payload) {
          return;
        }

        const anomaly = message.payload;
        setLatestAnomaly(anomaly);
        setToastMessage(`New ${anomaly.severity_level || "critical"} anomaly detected for building ${anomaly.building_name}!`);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => setToastMessage(null), TOAST_MS);
      };

      // reconnect with a growing delay
      source.onerror = () => {
        source?.close();
        source = null;
        if (stopped) {
          return;
        }
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retries);
        retries += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearTimeout(toastTimer);
      source?.close();
    };
  }, [listening]);

  return { latestAnomaly, toastMessage, setToastMessage };
}