import { z } from 'zod';

//this have been added to validate theme against the  ThemePreference prisma enum values to make sure the request body is in a specific structure
export const updateThemeSchema = z.object({
    theme: z.enum(['light', 'dark', 'system'], {
        error: "Theme must be light, dark, or system only.",
    }),
}).strict();

export type UpdateThemePayload = z.infer<typeof updateThemeSchema>;