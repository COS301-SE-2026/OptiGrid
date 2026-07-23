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

const UUID_REGEX = /^[0-9a-fA-F-]{36}$/;
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

// sensor listing validadtion
export const listSensorsSchema = z.object({
    building_id: z.string().regex(UUID_REGEX, "building_id must be a valid UUID"),
}).strict();

// validation of payload for creating a sensor
export const createSensorSchema = z.object({
    building_id: z.string().regex(UUID_REGEX, "building_id must be a valid UUID"),
    mac_address: z.string().regex(MAC_ADDRESS_REGEX, "mac_address must look like AA:BB:CC:DD:EE:FF"),

    sensor_type: z.string().max(100).optional(),
    unit: z.string().max(50).optional(),
    location_zone: z.string().max(100).optional(),
    status: z.enum(['Active', 'Offline', 'Maintenance']).optional(),
    installed_date: z.string().date("installed_date must be a YYYY-MM-DD date").optional()
}).strict();
export type CreateSensorPayload = z.infer<typeof createSensorSchema>;

export const deleteSensorSchema = z.object({
    sensor_id: z.string().regex(UUID_REGEX, "sensor_id must be a valid UUID"),
}).strict();