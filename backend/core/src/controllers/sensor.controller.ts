import {Request, Response} from "express"
import {forwardToIngestion} from "../services/sensor.services"

export const receiveSensorData = async (req: Request, res: Response) =>{
    try{
        const sensorData = req.body;
        await forwardToIngestion(sensorData);
        res.status(200).json({status: "success", "message": "Data received"});
    }
    catch(error){
        console.error("API gateway error forwarding sensor data");
        res.status(500).json({status: "error", "message": "Internal server error"});
    }
}
