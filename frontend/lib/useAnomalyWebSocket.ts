import { useState, useEffect } from "react";
import { Anomaly } from "@/components/sharedanomaly";

export function useAnomalyWebSocket() {
  const [latestAnomaly, setLatestAnomaly] = useState<Anomaly | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    //connect to the core backend web socket server directly
    const wsUrl = process.env.NEXT_PUBLIC_CORE_WS_URL || "ws://localhost:4000";
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (error) {
      console.error("Failed to initialize WebSocket: ", error);
      return;
    }

    ws.onopen = () => {
      console.log("Connected to anomaly WebSocket");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "ANOMALY_DETECTED") {
          const anomaly = data.payload;
          setLatestAnomaly(anomaly);
          const msg = `New ${anomaly.severity_level || "Critical"} anomaly detected for building ${anomaly.building_name}!`;
          setToastMessage(msg);
          setTimeout(() => {
            setToastMessage(null);
          }, 5000);
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Disconnected from anomaly WebSocket");
    };

    return () => {
      ws.close();
    };
  }, []);

  return { latestAnomaly, toastMessage, setToastMessage };
}
