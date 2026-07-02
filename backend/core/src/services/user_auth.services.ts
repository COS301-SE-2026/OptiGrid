import prisma from '../lib/prisma';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { Prisma } from '@prisma/client';

const USER_EXISTS_ERROR = 'User already exists, please login instead.';
// Reused public shape returned to API callers after signup.
const SIGNUP_USER_SELECT = {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
} as const;

// Shared payload used to write or update the app-level user profile row.
type SignupCreateData = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
};

// Captures the Supabase auth user id plus rollback behavior when app profile write fails.
type ProvisionedAuthUser = {
    userId: string;
    cleanup: () => Promise<void>;
};

type AuthenticatedAuthUser = {
    userId: string;
    email: string;
    accessToken: string;
};

// Service-role Supabase client for privileged auth admin actions (signup provisioning).
function getSupabaseAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Signup requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        realtime: {
            transport: ws,
        },
    });
}

// Anon-key Supabase client for end-user sign-in operations.
function getSupabaseAuthClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Login requires SUPABASE_URL and SUPABASE_ANON_KEY.');
    }

    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        realtime: {
            transport: ws,
        },
    });
}

// Detects duplicate-user errors returned by Supabase auth admin signup.
function isSupabaseDuplicateUserError(error: { message?: string; code?: string } | null): boolean {
    if (!error) {
        return false;
    }

    const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    return (
        code === 'user_already_exists' ||
        message.includes('already registered') ||
        message.includes('already been registered') ||
        message.includes('has already been registered') ||
        message.includes('already exists')
    );
}

// Detects invalid credential responses from Supabase sign-in.
function isSupabaseInvalidCredentialsError(error: { message?: string; code?: string } | null): boolean {
    if (!error) {
        return false;
    }

    const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    return code === 'invalid_credentials' || message.includes('invalid login credentials') || message.includes('invalid email or password');
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
    firstName: string;
    lastName: string;
}) {
    const maxAttempts = 5;
    const retryDelayMs = 250;

    // Supabase can create the public.users row asynchronously after auth user creation.
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await prisma.user.update({
                where: {
                    userId: createData.userId,
                },
                data: {
                    email: createData.email,
                    firstName: createData.firstName,
                    lastName: createData.lastName,
                },
                select: SIGNUP_USER_SELECT,
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

async function createOrUpsertUser(createData: SignupCreateData) {
    const userDelegate = prisma.user as unknown as {
        upsert?: (args: Prisma.UserUpsertArgs) => Promise<unknown>;
    };

    if (typeof userDelegate.upsert !== 'function') {
        throw new Error('Prisma user delegate is missing upsert method.');
    }

    // Upsert ensures the profile row is created or updated for the same auth user id.
    return prisma.user.upsert({
        where: {
            userId: createData.userId,
        },
        create: createData,
        update: {
            email: createData.email,
            firstName: createData.firstName,
            lastName: createData.lastName,
        },
        //we ensure not to show the password hash or return to frontend side
        select: SIGNUP_USER_SELECT,
    });
}

// Creates the Supabase auth identity first so app profile uses the canonical auth user id.
async function provisionAuthUser(email: string, password: string): Promise<ProvisionedAuthUser> {
    const supabase = getSupabaseAdminClient();

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

async function authenticateAuthUser(email: string, password: string): Promise<AuthenticatedAuthUser> {
    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        if (isSupabaseInvalidCredentialsError(error)) {
            throw new Error('Invalid email or password');
        }

        throw new Error(`Failed to authenticate user: ${error.message}`);
    }

    const userId = data.user?.id;
    if (!userId) {
        throw new Error('Failed to authenticate user: missing user id.');
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
        throw new Error('Failed to authenticate user: missing access token.');
    }

    return {
        userId,
        email: data.user?.email ?? email,
        accessToken,
    };
}

async function provisionOrResolveAuthUser(email: string, password: string): Promise<ProvisionedAuthUser> {
    try {
        return await provisionAuthUser(email, password);
    } catch (error) {
        if (!(error instanceof Error) || error.message !== USER_EXISTS_ERROR) {
            throw error;
        }

        try {
            const authUser = await authenticateAuthUser(email, password);

            return {
                userId: authUser.userId,
                // This auth identity predates this signup attempt; do not delete it on profile-write failure.
                cleanup: async () => {},
            };
        } catch (authError) {
            if (authError instanceof Error && authError.message === 'Invalid email or password') {
                throw new Error(USER_EXISTS_ERROR);
            }

            throw authError;
        }
    }
}

//This function is used for the signup logic
export const signup = async (email: string, password: string, name: string) => {
    //we check if user exists, and if so he should login
    const userExists = await prisma.user.findUnique({
        where: { email },
        select: { userId: true },
    });
    if (userExists) throw new Error(USER_EXISTS_ERROR);

    // //we hash passwords, split name and then add to users table
    // const hashPass = await hashPassword(password);
    const [firstName = '', ...otherNames] = name.trim().split(/\s+/);
    const lastName = otherNames.join(' ');

    // Prefer Supabase auth user id to satisfy schemas where users.user_id references auth.users.id.
    const provisionedAuthUser = await provisionOrResolveAuthUser(email, password);
    
    const createData = {
        userId: provisionedAuthUser.userId,
        email,
        firstName,
        lastName,
    };

    try {
        // Keep local users table in sync with the newly provisioned auth identity.
        const user = await createOrUpsertUser(createData);

        return user;
    } catch (error) {
        if (isUserIdUniqueConstraintError(error)) {
            // If Supabase inserted the row first, switch to update path instead of failing signup.
            return updateUserByUserIdWithRetry(createData);
        }

        // Roll back auth identity when profile persistence fails for non-retryable reasons.
        await provisionedAuthUser.cleanup();

        if (isUserIdForeignKeyError(error)) {
            throw new Error('Signup failed: users.user_id must reference auth.users.id. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        }

        throw error;
    }
};

//this function is used for the login logic
export const login = async (email: string, password: string) => {
    // Supabase verifies credentials; we no longer compare local password hashes in this service.
    const authUser = await authenticateAuthUser(email, password);

    // Resolve app profile by the authenticated Supabase user id.
    const existingUser = await prisma.user.findUnique({
        where: { userId: authUser.userId },
        select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
        },
    });

    const user = existingUser ?? await createOrUpsertUser({
        userId: authUser.userId,
        email: authUser.email,
        firstName: '',
        lastName: '',
    });

    return {
        user,
        accessToken: authUser.accessToken,
    };
};
