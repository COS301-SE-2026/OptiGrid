import {Request, Response} from "express";
import {contactSchema} from "../validation/contact.validation"
import {contactService} from "../services/contact.services"
import { success } from "zod";

export const handleSubmit = async (req: Request, resp: Response): Promise<void> => {
    try{
        const correct = contactSchema.parse(req.body);
        const out = await contactService.sendMail(correct);
        resp.status(200).json({
            success:true,
            message: "Received the ticket",
            id: out?.id
        });
    }
    catch (error: any) {
        resp.status(400).json({
            success: false,
            error: error.message
        });
    }
};

