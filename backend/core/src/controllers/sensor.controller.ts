import {Request, Response} from "express"
import {forwardToIngestionService} from "../services/sensor.services"
import {telemetrySchema} from "../validation/sensor.validation"

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
