import { z } from "zod";

export const contactSchema = z.object({
    inquiryType: z.string().min(1, "Inquiry Type is a required field"),
    subject: z.string().min(3, "Subject field must have at least 3 characters."),
    message: z.string().min(10, "Message field must have at least 10 characters."),
});