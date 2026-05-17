import {Request, Response} from "express"
import {forwardToIngestionService} from "../services/sensor.services"

export const handleSensorTelemetry = async (req: Request, res: Response): Promise<void> => {
    try{
        const telemetryData = req.body;

        //basic validation before moving down pipeline
        if(!telemetryData.sensor_id || !telemetryData.building_id || !telemetryData.usage){
            res.status(400).json({status: "error", message: "Missing required telemetry fields"});
            return;
        }
        await forwardToIngestionService(telemetryData);
    }
    catch(error :any){
        console.error("Core API Gateway error forwarding sensor data: ", error.message);
        res.status(500).json({status: 'error', 'message': "Failed to process telemetry payload."});
    }
}
