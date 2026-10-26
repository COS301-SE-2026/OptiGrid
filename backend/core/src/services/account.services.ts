import { AccountStatus, Prisma, UserRole } from '@prisma/client';
import { createClient, type User as AuthUser } from '@supabase/supabase-js';
import ws from 'ws';
import prisma from '../lib/prisma';
import {
    AccountNotFoundError,
    CurrentPasswordIncorrectError,
    LastActiveAdminError,
    PasswordNotAvailableError,
    PasswordRejectedError,
    ReauthenticationNeededError,
    SelfPermanentDeletionError,
} from '../errors/account.errors';
import { isSupabaseInvalidCredentialsError } from './user_auth.services';

const ACCOUNT_SELECT = {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
    roleType: true,
    accountStatus: true,
    deactivatedAt: true,
} as const;

const PROFILE_SELECT = {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
    roleType: true,
    preferredTheme: true,
    createdAt: true,
    updatedAt: true,
} as const;

// each list in a personal data export stops at this many rows, which keeps the request quick
export const EXPORT_ROW_LIMIT = 5000;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof PROFILE_SELECT }>;

export type ProfileChanges = {
    firstName: string;
    lastName: string;
};

export type PasswordChange = {
    currentPassword: string;
    newPassword: string;
};

type SignInDetails = {
    email: string;
    methods: string[];
    lastSignInAt: string | null;
};

type AuthRefusal = {
    code?: string;
    message: string;
};

function getSupabaseAdminClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Permanent account deletion requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
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

function getSupabaseAuthClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Account security requires SUPABASE_URL and SUPABASE_ANON_KEY.');
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

function toProfile(user: ProfileRow) {
    return {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        roleType: user.roleType,
        preferredTheme: user.preferredTheme.toLowerCase(),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}

function listSignInMethods(user: AuthUser): string[] {
    const primary = user.app_metadata?.provider;
    const listed: unknown[] = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [];
    const linked = (user.identities ?? []).map((identity) => identity.provider);
    const methods = [primary, ...listed, ...linked].filter(
        (method): method is string => typeof method === 'string' && method.length > 0,
    );

    return [...new Set(methods)];
}

async function readSignInDetails(accessToken: string): Promise<SignInDetails> {
    const supabase = getSupabaseAuthClient();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
        throw new Error(`Failed to read sign-in details: ${error?.message ?? 'no user returned'}`);
    }

    return {
        email: data.user.email ?? '',
        methods: listSignInMethods(data.user),
        lastSignInAt: data.user.last_sign_in_at ?? null,
    };
}

function toPasswordRejection(error: AuthRefusal): Error {
    const code = error.code?.toLowerCase() ?? '';

    if (code === 'same_password') {
        return new PasswordRejectedError('SAME_PASSWORD', 'Your new password must be different from your current one.');
    }
    if (code === 'weak_password') {
        return new PasswordRejectedError('WEAK_PASSWORD', 'That password is too easy to guess. Please choose a stronger one.');
    }
    if (code === 'reauthentication_needed') {
        return new ReauthenticationNeededError();
    }

    return new Error(`Failed to update the password: ${error.message}`);
}

//  This request is sent by hand with the token of the session which asked for the change
async function updatePasswordForSession(accessToken: string, password: string): Promise<AuthRefusal | null> {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Account security requires SUPABASE_URL and SUPABASE_ANON_KEY.');
    }

    const base = supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`;
    const response = await fetch(new URL('auth/v1/user', base), {
        method: 'PUT',
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
    });

    if (response.ok) {
        return null;
    }

    const reply = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const pick = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string');
    return {
        code: pick(reply.error_code, reply.code),
        message: pick(reply.msg, reply.message, reply.error_description) ?? `Supabase Auth answered ${response.status}`,
    };
}

function withCounts<T>(total: number, items: T[]) {
    return { total, included: items.length, items };
}

export async function getAccountOverview(userId: string, accessToken: string) {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: PROFILE_SELECT,
    });

    if (!user) {
        throw new AccountNotFoundError();
    }

    // The profile still loads when Supabase Auth cannot answer and only the sign in details are left out
    const signIn = await readSignInDetails(accessToken).catch(() => null);

    return {
        user: toProfile(user),
        security: signIn
            ? {
                signInMethods: signIn.methods,
                canChangePassword: signIn.methods.includes('email'),
                lastSignInAt: signIn.lastSignInAt,
            }
            : null,
    };
}

export async function updateProfile(userId: string, changes: ProfileChanges) {
    const current = await prisma.user.findUnique({
        where: { userId },
        select: PROFILE_SELECT,
    });

    if (!current) {
        throw new AccountNotFoundError();
    }

    const previous = {
        firstName: current.firstName ?? '',
        lastName: current.lastName ?? '',
    };

    if (previous.firstName === changes.firstName && previous.lastName === changes.lastName) {
        return { user: toProfile(current), previous, changed: false };
    }

    const updated = await prisma.user.update({
        where: { userId },
        data: {
            firstName: changes.firstName,
            lastName: changes.lastName,
            updatedAt: new Date(),
        },
        select: PROFILE_SELECT,
    });

    return { user: toProfile(updated), previous, changed: true };
}

export async function changePassword(userId: string, accessToken: string, change: PasswordChange) {
    const signIn = await readSignInDetails(accessToken);
    if (!signIn.email || !signIn.methods.includes('email')) {
        throw new PasswordNotAvailableError();
    }

    const verifier = getSupabaseAuthClient();
    const { data, error } = await verifier.auth.signInWithPassword({
        email: signIn.email,
        password: change.currentPassword,
    });

    if (error) {
        if (isSupabaseInvalidCredentialsError(error)) {
            throw new CurrentPasswordIncorrectError();
        }
        throw new Error(`Failed to verify the current password: ${error.message}`);
    }

    // the check session is only needed to prove the current password
    const verificationToken = data.session?.access_token;
    if (verificationToken) {
        await verifier.auth.admin.signOut(verificationToken, 'local').catch(() => undefined);
    }
    if (!verificationToken || data.user?.id !== userId) {
        throw new Error('Password verification returned a different session.');
    }

    // Supabase Auth ends every session except the one that sends the new password
    //Sending it with this device token keeps the person signed in here
    const refusal = await updatePasswordForSession(accessToken, change.newPassword);
    if (refusal) {
        throw toPasswordRejection(refusal);
    }
}

export async function signOutEverywhere(accessToken: string) {
    const supabase = getSupabaseAuthClient();
    const { error } = await supabase.auth.admin.signOut(accessToken, 'global');

    if (error) {
        throw new Error(`Failed to sign out of all devices: ${error.message}`);
    }
}

export async function buildPersonalDataExport(userId: string, accessToken: string) {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: {
            ...PROFILE_SELECT,
            accountStatus: true,
            deactivatedAt: true,
            tenant: {
                select: { companyName: true, subscriptionTier: true },
            },
            buildingAccess: {
                select: {
                    building: {
                        select: {
                            building_id: true,
                            building_name: true,
                            building_type: true,
                            physical_address: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        throw new AccountNotFoundError();
    }

    const [
        notificationTotal,
        notifications,
        resolvedTotal,
        resolvedAnomalies,
        activityTotal,
        activity,
        signIn,
    ] = await Promise.all([
        prisma.notification.count({ where: { user_id: userId } }),
        prisma.notification.findMany({
            where: { user_id: userId },
            orderBy: { sent_at: 'desc' },
            take: EXPORT_ROW_LIMIT,
            select: {
                notification_id: true,
                anomaly_id: true,
                channel: true,
                status: true,
                content: true,
                sent_at: true,
            },
        }),
        prisma.anomaly.count({ where: { resolved_by_user_id: userId } }),
        prisma.anomaly.findMany({
            where: { resolved_by_user_id: userId },
            orderBy: { resolved_timestamp: 'desc' },
            take: EXPORT_ROW_LIMIT,
            select: {
                anomaly_id: true,
                building_id: true,
                anomaly_type: true,
                severity_level: true,
                status: true,
                detected_timestamp: true,
                resolved_timestamp: true,
            },
        }),
        prisma.auditLog.count({ where: { user_id: userId } }),
        prisma.auditLog.findMany({
            where: { user_id: userId },
            orderBy: [{ timestamp: 'desc' }, { log_id: 'desc' }],
            take: EXPORT_ROW_LIMIT,
            select: {
                timestamp: true,
                action_type: true,
                target_table: true,
                building_id: true,
                ip_address: true,
            },
        }),
        readSignInDetails(accessToken).catch(() => null),
    ]);

    return {
        exportedAt: new Date().toISOString(),
        about: 'A copy of the personal information OptiGrid holds about you. It was created on request from the Settings page.',
        account: {
            userId: user.userId,
            email: user.email,
            firstName: user.firstName ?? '',
            lastName: user.lastName ?? '',
            role: user.roleType,
            theme: user.preferredTheme.toLowerCase(),
            status: user.accountStatus,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            deactivatedAt: user.deactivatedAt,
        },
        signIn: signIn
            ? { methods: signIn.methods, lastSignInAt: signIn.lastSignInAt }
            : null,
        organisation: user.tenant
            ? { name: user.tenant.companyName, plan: user.tenant.subscriptionTier }
            : null,
        buildingAccess: {
            // Administrators can open every building
            scope: user.roleType === UserRole.ADMIN ? 'all buildings' : 'assigned buildings',
            buildings: user.buildingAccess.map(({ building }) => ({
                buildingId: building.building_id,
                name: building.building_name,
                type: building.building_type,
                address: building.physical_address,
            })),
        },
        notifications: withCounts(notificationTotal, notifications.map((notification) => ({
            notificationId: notification.notification_id,
            anomalyId: notification.anomaly_id,
            channel: notification.channel,
            status: notification.status,
            message: notification.content,
            sentAt: notification.sent_at,
        }))),
        resolvedAnomalies: withCounts(resolvedTotal, resolvedAnomalies.map((anomaly) => ({
            anomalyId: anomaly.anomaly_id,
            buildingId: anomaly.building_id,
            type: anomaly.anomaly_type,
            severity: anomaly.severity_level,
            status: anomaly.status,
            detectedAt: anomaly.detected_timestamp,
            resolvedAt: anomaly.resolved_timestamp,
        }))),
        activity: withCounts(activityTotal, activity.map((entry) => ({
            at: entry.timestamp,
            action: entry.action_type,
            target: entry.target_table,
            buildingId: entry.building_id,
            ipAddress: entry.ip_address,
        }))),
    };
}

export async function deactivateAccount(userId: string) {
    const user = await prisma.user.findUnique({
        where: { userId },
        select: ACCOUNT_SELECT,
    });

    if (!user) {
        throw new AccountNotFoundError();
    }

    if (user.accountStatus === AccountStatus.DEACTIVATED) {
        return user;
    }

    if (user.roleType === UserRole.ADMIN) {
        const activeAdminCount = await prisma.user.count({
            where: {
                roleType: UserRole.ADMIN,
                accountStatus: AccountStatus.ACTIVE,
            },
        });

        if (activeAdminCount <= 1) {
            throw new LastActiveAdminError();
        }
    }

    return prisma.user.update({
        where: { userId },
        data: {
            accountStatus: AccountStatus.DEACTIVATED,
            deactivatedAt: new Date(),
        },
        select: ACCOUNT_SELECT,
    });
}

export async function permanentlyDeleteAccount(requesterId: string, targetUserId: string) {
    if (requesterId === targetUserId) {
        throw new SelfPermanentDeletionError();
    }

    const target = await prisma.user.findUnique({
        where: { userId: targetUserId },
        select: ACCOUNT_SELECT,
    });

    if (!target) {
        throw new AccountNotFoundError();
    }

    if (target.roleType === UserRole.ADMIN && target.accountStatus === AccountStatus.ACTIVE) {
        const activeAdminCount = await prisma.user.count({
            where: {
                roleType: UserRole.ADMIN,
                accountStatus: AccountStatus.ACTIVE,
            },
        });

        if (activeAdminCount <= 1) {
            throw new LastActiveAdminError();
        }
    }

    // Supabase Auth owns the identity. Delete it first so password login and
    // token refresh stop immediately; public.users normally cascades from it.
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(targetUserId);
    if (error) {
        throw new Error(`Failed to permanently delete auth user: ${error.message}`);
    }

    // Some environments do not have the auth.users -> public.users cascade.
    // Remove the profile explicitly there, while treating an already-cascaded
    // row as a successful deletion.
    try {
        await prisma.user.delete({ where: { userId: targetUserId } });
    } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2025') {
            throw error;
        }
    }

    return target;
}
