import prisma from "../lib/prisma";
import type { CreateSensorPayload } from "../validation/sensor.validation";

// url to ingestion api
const INGESTION_URL = process.env.INGESTION_API_URL || "http://ingestion-api:8000/ingest"

//forwards sensor data to ingestion API via HTTP POST
export const forwardToIngestionService = async (data: any): Promise<any> => {
    const response = await fetch(INGESTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });

    //throw error if ingestion api fails
    if (!response.ok)
        throw new Error(`Ingestion API responded with status: ${response.status}`);
    return await response.json();
}

// everyone must be assigned to the building to access it except
const buildingAccess = async (userId: string, buildingId: string, role: string) => {
    const building = await prisma.building.findUnique({
        where: { building_id: buildingId }
    });
    if (!building) {
        throw new Error("Building not found");
    }

    if (role !== "ADMIN") {
        const accessRight = await prisma.userBuildingAccess.findUnique({
            where: {
                user_id_building_id: {
                    user_id: userId,
                    building_id: buildingId
                },
            },
        });
        if (!accessRight) {
            throw new Error("Access Denied. You do not have permission to access this building.");
        }
    }
};

//every sensor belongs to exactly one building 
export const listSensorsForBuilding = async (userId: string, buildingId: string, role: string = "VIEWER") => {
    await buildingAccess(userId, buildingId, role);

    return prisma.sensor.findMany({
        where: { building_id: buildingId },
        orderBy: { created_at: "asc" }
    });
};

export const registerSensorService = async (userId: string, payload: CreateSensorPayload, role: string = "VIEWER") => {
    await buildingAccess(userId, payload.building_id, role);
    return prisma.sensor.create({
        data: {
            building_id: payload.building_id,
            mac_address: payload.mac_address.toUpperCase(),
            sensor_type: payload.sensor_type,
            unit: payload.unit ?? "kWh",
            location_zone: payload.location_zone,
            status: payload.status ?? "Active",
            ...(payload.installed_date !== undefined
                ? { installed_date: new Date(payload.installed_date) }
                : {}),
        },
    });
};

export const deleteSensorService = async (userId: string, sensorId: string, role: string = "VIEWER") => {
    const sensor = await prisma.sensor.findUnique({
        where: { sensor_id: sensorId },
    });
    if (!sensor?.building_id) {
        throw new Error("Sensor not found")
    };

    await buildingAccess(userId, sensor.building_id, role);
    return prisma.sensor.delete({
        where: { sensor_id: sensorId }
    });
};