import { redis } from "../lib/redis";
import { sseManager } from "../utils/sseManager";

export const startTelemetry = () => {
    const subscriber = redis.duplicate();
    
    subscriber.on("connect", () => {console.log("Telemetry connected to Redis");});
    subscriber.subscribe("live_telemetry", (err: Error | null, count: number) => {
        if(err) console.error("Failed to subscribe to live_telemetry:", err);
        else console.log(`Subscribed to live_telemetry channel. Total subscriptions: ${count}`);
    });

    subscriber.on("message", (channel: string, message: string) => {
        if(channel === "live_telemetry") {
            try{
                const payload = JSON.parse(message);
                if(payload.building_id) {
                    sseManager.broadcast(payload.building_id, payload);
                    sseManager.broadcast("portfolio", payload);
                }
            } 
            catch(err) {
                console.error("Failed to parse live_telemetry message:", err);
            }
        }
    });
};
