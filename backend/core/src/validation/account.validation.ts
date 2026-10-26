import { z } from 'zod';

const NAME_PATTERN = /^\p{L}[\p{L}\p{M}'\u2019 .-]*$/u;
const NAME_MESSAGE = 'Use letters for names. Hyphens and apostrophes are fine too.';
const NAME_MAX_LENGTH = 60;

// supabase auth hashes passwords with bcrypt whic reads the first 72 bytes only
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const collapseSpaces = (value: string) => value.replace(/\s+/g, ' ');

export const updateProfileSchema = z.object({
    firstName: z
        .string({ error: 'Enter your first name.' })
        .trim()
        .min(1, 'Enter your first name.')
        .max(NAME_MAX_LENGTH, `First name can be at most ${NAME_MAX_LENGTH} characters.`)
        .refine((value) => value === '' || NAME_PATTERN.test(value), NAME_MESSAGE)
        .transform(collapseSpaces),
    lastName: z
        .string({ error: 'Last name must be text.' })
        .trim()
        .max(NAME_MAX_LENGTH, `Last name can be at most ${NAME_MAX_LENGTH} characters.`)
        .refine((value) => value === '' || NAME_PATTERN.test(value), NAME_MESSAGE)
        .transform(collapseSpaces),
}).strict();

export const changePasswordSchema = z.object({
    currentPassword: z
        .string({ error: 'Enter your current password.' })
        .min(1, 'Enter your current password.')
        .max(256, 'Enter your current password.'),
    newPassword: z
        .string({ error: 'Enter a new password.' })
        .min(8, 'Your new password needs at least 8 characters.')
        .refine((value) => Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES, 'Your new password is too long. Keep it under 72 characters.')
        .refine((value) => PASSWORD_PATTERN.test(value), 'Mix upper and lower case letters with at least one number and one symbol.'),

    signOutOtherDevices: z.boolean({ error: 'signOutOtherDevices must be true or false.' }).optional(),
}).strict().refine((body) => body.newPassword !== body.currentPassword, {
    path: ['newPassword'],
    message: 'Your new password must be different from your current one.',
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;