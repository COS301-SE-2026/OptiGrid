import { z } from 'zod';

// we also need a strict schema here as well so unknown fields are rejected and never forwarded to the ingestion pipeline
export const telemetrySchema = z.object({
    sensor_id: z.string().min(1, "sensor_id is required").max(255),
    building_id: z.string().min(1, "building_id is required").max(255),
    
    //devices may send usage as a number or as a numeric string
    usage: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
        z.number({ error: "usage must be a number" }).finite("usage must be a finite number"),
    ),
    meter_id: z.string().max(255).optional(),
    timestamp: z.string().datetime({ offset: true, message: "timestamp must be an ISO-8601 date-time string" }).optional(),
}).strict();

export type TelemetryPayload = z.infer<typeof telemetrySchema>;