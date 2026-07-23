import { AccountStatus, Prisma, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import prisma from '../lib/prisma';
import {
    AccountNotFoundError,
    LastActiveAdminError,
    SelfPermanentDeletionError,
} from '../errors/account.errors';

const ACCOUNT_SELECT = {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
    roleType: true,
    accountStatus: true,
    deactivatedAt: true,
} as const;

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
