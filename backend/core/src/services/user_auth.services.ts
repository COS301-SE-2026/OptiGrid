import prisma from '../lib/prisma';
import { comparePass, hashPassword } from '../lib/password';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Prisma } from '@prisma/client';

const USER_EXISTS_ERROR = 'User already exists, please login instead.';

type ProvisionedAuthUser = {
    userId: string;
    cleanup: () => Promise<void>;
};

function getSupabaseAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

function isSupabaseDuplicateUserError(error: { message?: string; code?: string } | null): boolean {
    if (!error) {
        return false;
    }

    const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    return (
        code === 'user_already_exists' ||
        message.includes('already registered') ||
        message.includes('already exists')
    );
}

function isUserIdForeignKeyError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        const fieldName = String((error.meta as Record<string, unknown> | undefined)?.field_name ?? '').toLowerCase();
        return fieldName.includes('users_user_id_fkey') || fieldName.includes('user_id');
    }

    if (error instanceof Error) {
        return error.message.includes('users_user_id_fkey');
    }

    return false;
}

function isUserIdUniqueConstraintError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = (error.meta as Record<string, unknown> | undefined)?.target;
        const targetText = Array.isArray(target) ? target.join(',').toLowerCase() : String(target ?? '').toLowerCase();
        return targetText.includes('user_id') || targetText.includes('userid');
    }

    if (error instanceof Error) {
        return error.message.includes('Unique constraint failed on the fields: (`user_id`)');
    }

    return false;
}

function isRecordNotFoundError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

async function updateUserByUserIdWithRetry(createData: {
    userId: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
}) {
    const maxAttempts = 5;
    const retryDelayMs = 250;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await prisma.user.update({
                where: {
                    userId: createData.userId,
                },
                data: {
                    email: createData.email,
                    passwordHash: createData.passwordHash,
                    firstName: createData.firstName,
                    lastName: createData.lastName,
                },
                select: {
                    userId: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                },
            });
        } catch (error) {
            if (!isRecordNotFoundError(error) || attempt === maxAttempts) {
                throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }

    throw new Error('Failed to update user after retries.');
}

async function provisionAuthUser(email: string, password: string): Promise<ProvisionedAuthUser | null> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) {
        return null;
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    if (error) {
        if (isSupabaseDuplicateUserError(error)) {
            throw new Error(USER_EXISTS_ERROR);
        }
        throw new Error(`Failed to provision auth user: ${error.message}`);
    }

    const userId = data.user?.id;
    if (!userId) {
        throw new Error('Failed to provision auth user: missing user id.');
    }

    return {
        userId,
        cleanup: async () => {
            const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
            if (deleteError) {
                console.error(`Failed to rollback auth user ${userId}: ${deleteError.message}`);
            }
        },
    };
}

//This function is used for the signup logic
export const signup = async (email: string, password: string, name: string) => {
    //we check if user exists, and if so he should login
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) throw new Error(USER_EXISTS_ERROR);

    //we hash passwords, split name and then add to users table
    const hashPass = await hashPassword(password);
    const [firstName = '', ...otherNames] = name.trim().split(/\s+/);
    const lastName = otherNames.join(' ');

    const provisionedAuthUser = await provisionAuthUser(email, password);
    
    const createData = {
        userId: provisionedAuthUser?.userId ?? randomUUID(),
        email,
        passwordHash: hashPass,
        firstName,
        lastName,
    };

    try {
        const user = await prisma.user.upsert({
            where: {
                userId: createData.userId,
            },
            create: createData,
            update: {
                email: createData.email,
                passwordHash: createData.passwordHash,
                firstName: createData.firstName,
                lastName: createData.lastName,
            },
            //we ensure not to show the password hash or return to frontend side
            select: {
                userId: true,
                email: true,
                firstName: true,
                lastName: true,
            },
        });

        return user;
    } catch (error) {
        if (isUserIdUniqueConstraintError(error)) {
            return updateUserByUserIdWithRetry(createData);
        }

        if (provisionedAuthUser) {
            await provisionedAuthUser.cleanup();
        }

        if (isUserIdForeignKeyError(error)) {
            throw new Error('Signup failed: users.user_id must reference auth.users.id. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        }

        throw error;
    }
};

//this function is used for the login logic
export const login = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({
        where: {email},
        select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
            passwordHash: true,
        }
    });

    if(!user){
        throw new Error("Invalid email or password");
    }

    const isPasswordValid = await comparePass(password, user.passwordHash);
    if (!isPasswordValid) {
        throw new Error("Invalid email or password");
    }

    const {passwordHash, ...safeUser} = user;
    return safeUser;
};
