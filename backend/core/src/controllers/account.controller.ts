import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { UserRole } from '@prisma/client';
import {
    buildPersonalDataExport,
    changePassword,
    deactivateAccount,
    getAccountOverview,
    permanentlyDeleteAccount,
    signOutEverywhere,
    updateProfile,
} from '../services/account.services';
import {
    AccountNotFoundError,
    CurrentPasswordIncorrectError,
    LastActiveAdminError,
    PasswordNotAvailableError,
    PasswordRejectedError,
    SelfPermanentDeletionError,
} from '../errors/account.errors';
import { changePasswordSchema, updateProfileSchema } from '../validation/account.validation';
import { getClientIp, recordAuditLog } from '../services/auditLog.service';

const userIdParamsSchema = z.object({
    userId: z.string().uuid(),
});

// authenticateRequest has already checked this tokenase Auth.
function readBearerToken(req: Request): string | null {
    const [scheme, token] = (req.header('authorization') ?? '').trim().split(/\s+/);
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

function sendValidationError(res: Response, error: ZodError) {
    return res.status(400).json({
        message: 'Validation error',
        errors: error.issues.map((issue) => ({
            field: issue.path.length ? issue.path.join('.') : 'body',
            message: issue.message,
        })),
    });
}

function sendUnauthorized(res: Response) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized' });
}

export async function getMyAccount(req: Request, res: Response) {
    const userId = req.user?.id;
    const accessToken = readBearerToken(req);
    if (!userId || !accessToken) {
        return sendUnauthorized(res);
    }

    try {
        const account = await getAccountOverview(userId, accessToken);
        return res.status(200).json(account);
    } catch (error: unknown) {
        if (error instanceof AccountNotFoundError) {
            return res.status(404).json({ code: error.code, message: error.message });
        }

        console.error('Account overview error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function updateMyProfile(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
        return sendUnauthorized(res);
    }

    const parsed = updateProfileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        return sendValidationError(res, parsed.error);
    }

    try {
        const result = await updateProfile(userId, parsed.data);
        if (result.changed) {
            await recordAuditLog({
                userId,
                actionType: 'UPDATE',
                targetTable: 'users',
                oldValue: result.previous,
                newValue: parsed.data,
                ipAddress: getClientIp(req),
            });
        }

        return res.status(200).json({ message: 'Profile updated', user: result.user });
    } catch (error: unknown) {
        if (error instanceof AccountNotFoundError) {
            return res.status(404).json({ code: error.code, message: error.message });
        }

        console.error('Profile update error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function changeMyPassword(req: Request, res: Response) {
    const userId = req.user?.id;
    const accessToken = readBearerToken(req);
    if (!userId || !accessToken) {
        return sendUnauthorized(res);
    }

    const parsed = changePasswordSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        return sendValidationError(res, parsed.error);
    }

    try {
        const { signedOutOtherDevices } = await changePassword(userId, accessToken, parsed.data);
        await recordAuditLog({
            userId,
            actionType: 'PASSWORD_CHANGE',
            targetTable: 'users',
            newValue: { signedOutOtherDevices },
            ipAddress: getClientIp(req),
        });

        return res.status(200).json({ message: 'Password changed', signedOutOtherDevices });
    } catch (error: unknown) {
        if (error instanceof CurrentPasswordIncorrectError) {
            return res.status(400).json({ code: error.code, field: 'currentPassword', message: error.message });
        }
        if (error instanceof PasswordRejectedError) {
            return res.status(400).json({ code: error.code, field: 'newPassword', message: error.message });
        }
        if (error instanceof PasswordNotAvailableError) {
            return res.status(409).json({ code: error.code, message: error.message });
        }

        console.error('Password change error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function signOutAllDevices(req: Request, res: Response) {
    const userId = req.user?.id;
    const accessToken = readBearerToken(req);
    if (!userId || !accessToken) {
        return sendUnauthorized(res);
    }

    try {
        await signOutEverywhere(accessToken);
        await recordAuditLog({
            userId,
            actionType: 'LOGOUT_ALL_DEVICES',
            targetTable: 'users',
            ipAddress: getClientIp(req),
        });

        return res.status(200).json({ message: 'Signed out of all devices' });
    } catch (error: unknown) {
        console.error('Sign out everywhere error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function exportMyData(req: Request, res: Response) {
    const userId = req.user?.id;
    const accessToken = readBearerToken(req);
    if (!userId || !accessToken) {
        return sendUnauthorized(res);
    }

    try {
        const personalData = await buildPersonalDataExport(userId, accessToken);
        await recordAuditLog({
            userId,
            actionType: 'DATA_EXPORT',
            targetTable: 'users',
            newValue: { activityIncluded: personalData.activity.included },
            ipAddress: getClientIp(req),
        });

        const day = personalData.exportedAt.slice(0, 10);
        res.setHeader('Content-Disposition', `attachment; filename="optigrid-my-data-${day}.json"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(personalData);
    } catch (error: unknown) {
        if (error instanceof AccountNotFoundError) {
            return res.status(404).json({ code: error.code, message: error.message });
        }

        console.error('Personal data export error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

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
        if (error instanceof LastActiveAdminError) {
            return res.status(409).json({ code: error.code, message: error.message });
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
