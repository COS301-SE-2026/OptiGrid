import {Request, Response} from "express"
import {forwardToIngestionService, listSensorsForBuilding, registerSensorService, deleteSensorService} from "../services/sensor.services"
import {telemetrySchema, listSensorsSchema, createSensorSchema,deleteSensorSchema} from "../validation/sensor.validation"

// handing incoming sensor data from IoT devices
export const handleSensorTelemetry = async (req: Request, res: Response): Promise<void> => {
    try{
        //so I added the strict validation here before moving down pipeline and z unknown fields are rejected now
        const telemetryData = telemetrySchema.parse(req.body);

        // forward validated data to ingestion service (which sends to redis)
        const ingestionResponse = await forwardToIngestionService(telemetryData);
        res.status(200).json({
            status: "success",
            data: ingestionResponse,
        });
    }
    catch(error :any){
        if(error.name === "ZodError"){
            res.status(400).json({status: "error", message: "Invalid telemetry payload", details: error.errors});
            return;
        }
        console.error("Core API Gateway error forwarding sensor data: ", error.message);
        res.status(500).json({status: 'error', 'message': "Failed to process telemetry payload."});
    }
}

// this function basically is used by the controllers to return the same standard errors
const respondToSensorError = (res: Response, error: any) => {
    if (error.name === "ZodError") {
        return res.status(400).json({
            status: "error",
            message: "Invalid request payload",
            details: error.errors
        });
    }
    if (error.message?.includes("Access Denied")) {
        return res.status(403).json({ 
            status: "error", 
            message: error.message 
        });
    }

    if (error.message === "Building not found" || error.message === "Sensor not found") {
        return res.status(404).json({ 
            status: "error", 
            message: error.message 
        });
    }
    // if we there prisma unique constraint then the mac address is already registered
    if (error.code === "P2002") {
        return res.status(409).json({
            status: "error",
            message: "A sensor with this MAC address is already registered"
        });
    }

    console.error("Sensor controller error: ", error);
    return res.status(500).json({ 
        status: "error", 
        message: "Internal server error"
    });
};

export const listSensorsController = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ status: "error", message: "Unauthorized" });
        }

        //viewing sensors is allowed for every role that has access to the building
        const { building_id } = listSensorsSchema.parse(req.query);
        const sensors = await listSensorsForBuilding(req.user.id, building_id, req.user.roleType);

        return res.status(200).json({ status: "success", data: sensors });
    } catch (error: any) {
        return respondToSensorError(res, error);
    }
};

export const registerSensorController = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                status: "error", 
                message: "Unauthorized" 
            });
        }

        // the rbac is applied here so only admins and building managers could register sensors
        const role = req.user.roleType;
        if (role !== "ADMIN" && role !== "BUILDING_MANAGER") {
            return res.status(403).json({
                status: "error",
                message: "You do not have permission to register a sensor",
            });
        }

        const validatedPayload = createSensorSchema.parse(req.body);
        const sensor = await registerSensorService(req.user.id, validatedPayload, role);

        return res.status(201).json({ 
            status: "success",
            data: sensor 
        });
    } catch (error: any) {
        return respondToSensorError(res, error);
    }
};

export const deleteSensorController = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                status: "error", 
                message: "Unauthorized" 
            });
        }
        // Also rbac here so only admins and building managers may delete sensors
        const role = req.user.roleType;
        if (role !== "ADMIN" && role !== "BUILDING_MANAGER") {
            return res.status(403).json({
                status: "error",
                message: "You do not have permission to delete a sensor",
            });
        }

        const { sensor_id } = deleteSensorSchema.parse(req.params);
        await deleteSensorService(req.user.id, sensor_id, role);

        return res.status(200).json({
            status: "success",
            message: "Sensor successfully deleted",
        });
    } catch (error: any) {
        return respondToSensorError(res, error);
    }
}