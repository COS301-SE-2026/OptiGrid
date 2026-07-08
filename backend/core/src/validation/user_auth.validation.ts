import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodIssue, ZodTypeAny } from 'zod';

//schema to validate password, email and name for signup
export const signupSchema = z.object({
    email: z.string().email({ message: 'Invalid email address' }),
    password: z
        .string()
        .min(8, { message: 'Password must be at least 8 characters' })
        .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/, {
            message:'Password must include at least one uppercase letter, one number, and one special character',
        }),
    name: z.string().min(3, { message: 'Name must be 3 or more characters' }),
        roleType: z.preprocess(
            (value) => (typeof value === 'string' ? value.toUpperCase() : value),
            z.enum(['ADMIN', 'BUILDING_MANAGER', 'VIEWER'])
        ).optional(),});


export const validateSignUp = (schema: ZodTypeAny) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        //we just ensuring field are validated 
        try {
            const parsed = await schema.parseAsync(req.body);
            req.body = parsed;
            return next();
        } 
        catch (err) {
            //in the insatnce we get an error, we return the respective error message
            if (!(err instanceof ZodError)) {
                return res.status(500).json({ 
                    message: 'Internal server error' 
                });
            }
            const formatted = (err.issues || []).map((e: ZodIssue) => ({
                field: (e.path && e.path.length ? e.path.join('.') : 'body'),
                message: e.message,
            }));

            return res.status(400).json({ message: 'Validation error', errors: formatted });
        }
    };
};
