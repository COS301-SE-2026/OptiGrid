import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { UserRole } from '@prisma/client';
import {
    deactivateAccount,
    permanentlyDeleteAccount,
} from '../services/account.services';
import {
    AccountNotFoundError,
    LastActiveAdminError,
    SelfPermanentDeletionError,
} from '../errors/account.errors';

const userIdParamsSchema = z.object({
    userId: z.string().uuid(),
});

export async function deactivateMyAccount(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    try {
        const user = await deactivateAccount(userId);
        return res.status(200).json({
            message: 'Account deactivated successfully',
            user,
        });
    } catch (error: unknown) {
        if (error instanceof AccountNotFoundError) {
            return res.status(404).json({ code: error.code, message: error.message });
        }

        console.error('Account deactivation error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function permanentlyDeleteUser(req: Request, res: Response) {
    const requester = req.user;
    if (!requester) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    if (requester.roleType !== UserRole.ADMIN) {
        return res.status(403).json({
            status: 'error',
            message: 'Administrator permission is required.',
        });
    }

    try {
        const { userId } = userIdParamsSchema.parse(req.params);
        const deletedUser = await permanentlyDeleteAccount(requester.id, userId);
        return res.status(200).json({
            message: 'Account permanently deleted',
            user: deletedUser,
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            return res.status(400).json({ message: 'Invalid user id.' });
        }
        if (
            error instanceof AccountNotFoundError ||
            error instanceof LastActiveAdminError ||
            error instanceof SelfPermanentDeletionError
        ) {
            const status = error instanceof AccountNotFoundError ? 404 : 409;
            return res.status(status).json({ code: error.code, message: error.message });
        }

        console.error('Permanent account deletion error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
