import {Request, Response} from "express";
import {contactSchema} from "../validation/contact.validation"
import {contactService} from "../services/contact.services"
import { checkIdempotencyKey, saveIdempotencyKey } from "../services/idempotency.services";

export const handleSubmit = async (req: Request, resp: Response): Promise<void> => {
    try{
        //added for idempotency key, hits redis cache
        // this endpoint is public (no login required so no user id) so idempotency keys live under a fixed "contact" namespace 
        // to keep them separate from per-user building keys
        const key = req.headers["idempotency-key"] as string;
        if(key) {
            const cachedResp = await checkIdempotencyKey("contact", key);
            if(cachedResp) {
                resp.status(200).json(cachedResp);
                return;
            }
        }
        const correct = contactSchema.parse(req.body);
        const out = await contactService.sendMail(correct);
        const load = {
            success: true,
            message: "Recieved the ticket",
            id: out?.id
        };
        
        if(key) await saveIdempotencyKey("contact", key, load);
        resp.status(200).json(load);
    }
    catch (error: any) {
        resp.status(400).json({
            success: false,
            error: error.message
        });
    }
};

