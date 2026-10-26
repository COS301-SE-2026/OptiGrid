import type { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import {
    AccountNotFoundError,
    CurrentPasswordIncorrectError,
    LastActiveAdminError,
    PasswordNotAvailableError,
    PasswordRejectedError,
    ReauthenticationNeededError,
    SelfPermanentDeletionError,
} from '../../../backend/core/src/errors/account.errors';
import * as accountServices from '../../../backend/core/src/services/account.services';
import * as auditLogService from '../../../backend/core/src/services/auditLog.service';
import {
    changeMyPassword,
    deactivateMyAccount,
    exportMyData,
    getMyAccount,
    permanentlyDeleteUser,
    signOutAllDevices,
    updateMyProfile,
} from '../../../backend/core/src/controllers/account.controller';

jest.mock('../../../backend/core/src/services/account.services', () => ({
    deactivateAccount: jest.fn(),
    permanentlyDeleteAccount: jest.fn(),
    getAccountOverview: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    signOutEverywhere: jest.fn(),
    buildPersonalDataExport: jest.fn(),
}));

jest.mock('../../../backend/core/src/services/auditLog.service', () => ({
    recordAuditLog: jest.fn(),
    getClientIp: jest.fn(),
}));

const mockedAccountServices = accountServices as jest.Mocked<typeof accountServices>;
const mockedAudit = auditLogService as jest.Mocked<typeof auditLogService>;

function mockResponse() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return {
        res: { status } as unknown as Response,
        status,
        json,
    };
}

const viewer = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'viewer@example.com',
    firstName: 'Viewer',
    lastName: 'User',
    roleType: UserRole.VIEWER,
};

describe('account controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('deactivateMyAccount', () => {
        it('returns 401 when the request has no authenticated user', async () => {
            const { res, status, json } = mockResponse();

            await deactivateMyAccount({} as Request, res);

            expect(status).toHaveBeenCalledWith(401);
            expect(json).toHaveBeenCalledWith({ status: 'error', message: 'Unauthorized' });
            expect(mockedAccountServices.deactivateAccount).not.toHaveBeenCalled();
        });

        it('returns the deactivated account for an authenticated user', async () => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.deactivateAccount.mockResolvedValue(viewer as never);

            await deactivateMyAccount({
                user: { id: viewer.userId, roleType: UserRole.VIEWER, user_metadata: {} },
            } as Request, res);

            expect(mockedAccountServices.deactivateAccount).toHaveBeenCalledWith(viewer.userId);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({
                message: 'Account deactivated successfully',
                user: viewer,
            });
        });

        it('returns 404 when the account profile is missing', async () => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.deactivateAccount.mockRejectedValue(new AccountNotFoundError());

            await deactivateMyAccount({
                user: { id: viewer.userId, roleType: UserRole.VIEWER, user_metadata: {} },
            } as Request, res);

            expect(status).toHaveBeenCalledWith(404);
            expect(json).toHaveBeenCalledWith({
                code: 'ACCOUNT_NOT_FOUND',
                message: 'Account profile was not found.',
            });
        });
    });

    it('returns 409 when the last active administrator tries to deactivate', async () => {
        const { res, status, json } = mockResponse();
        mockedAccountServices.deactivateAccount.mockRejectedValue(new LastActiveAdminError());

        await deactivateMyAccount({
            user: { id: viewer.userId, roleType: UserRole.ADMIN, user_metadata: {} },
        } as Request, res);

        expect(status).toHaveBeenCalledWith(409);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'LAST_ACTIVE_ADMIN' }));
    });

    describe('permanentlyDeleteUser', () => {
        const targetUserId = '22222222-2222-4222-8222-222222222222';
        const adminRequest = {
            user: {
                id: '33333333-3333-4333-8333-333333333333',
                roleType: UserRole.ADMIN,
                user_metadata: {},
            },
            params: { userId: targetUserId },
        } as unknown as Request;

        it('returns 401 when the request has no authenticated user', async () => {
            const { res, status, json } = mockResponse();

            await permanentlyDeleteUser({ params: { userId: targetUserId } } as unknown as Request, res);

            expect(status).toHaveBeenCalledWith(401);
            expect(json).toHaveBeenCalledWith({ status: 'error', message: 'Unauthorized' });
            expect(mockedAccountServices.permanentlyDeleteAccount).not.toHaveBeenCalled();
        });

        it('returns 403 when the requester is not an administrator', async () => {
            const { res, status, json } = mockResponse();

            await permanentlyDeleteUser({
                user: { id: viewer.userId, roleType: UserRole.VIEWER, user_metadata: {} },
                params: { userId: targetUserId },
            } as unknown as Request, res);

            expect(status).toHaveBeenCalledWith(403);
            expect(json).toHaveBeenCalledWith({
                status: 'error',
                message: 'Administrator permission is required.',
            });
            expect(mockedAccountServices.permanentlyDeleteAccount).not.toHaveBeenCalled();
        });

        it('returns 400 when the target user id is invalid', async () => {
            const { res, status, json } = mockResponse();

            await permanentlyDeleteUser({
                user: adminRequest.user,
                params: { userId: 'not-a-uuid' },
            } as unknown as Request, res);

            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith({ message: 'Invalid user id.' });
            expect(mockedAccountServices.permanentlyDeleteAccount).not.toHaveBeenCalled();
        });

        it('returns the permanently deleted account for an administrator', async () => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.permanentlyDeleteAccount.mockResolvedValue(viewer as never);

            await permanentlyDeleteUser(adminRequest, res);

            expect(mockedAccountServices.permanentlyDeleteAccount).toHaveBeenCalledWith(
                adminRequest.user?.id,
                targetUserId,
            );
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({
                message: 'Account permanently deleted',
                user: viewer,
            });
        });

        it.each([
            [new AccountNotFoundError(), 404, 'ACCOUNT_NOT_FOUND'],
            [new LastActiveAdminError(), 409, 'LAST_ACTIVE_ADMIN'],
            [new SelfPermanentDeletionError(), 409, 'SELF_PERMANENT_DELETION_FORBIDDEN'],
        ])('maps %s to the expected response', async (error, expectedStatus, expectedCode) => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.permanentlyDeleteAccount.mockRejectedValue(error);

            await permanentlyDeleteUser(adminRequest, res);

            expect(status).toHaveBeenCalledWith(expectedStatus);
            expect(json).toHaveBeenCalledWith({
                code: expectedCode,
                message: error.message,
            });
        });
    });
});

describe('account self-service controller', () => {
    const accessToken = 'access-token-123';

    function signedInRequest(extra: Partial<Request> = {}): Request {
        return {
            user: { id: viewer.userId, roleType: UserRole.VIEWER, user_metadata: {} },
            header: jest.fn((name: string) => (name.toLowerCase() === 'authorization' ? `Bearer ${accessToken}` : undefined)),
            body: {},
            ...extra,
        } as unknown as Request;
    }

    function mockDownloadResponse() {
        const json = jest.fn();
        const status = jest.fn().mockReturnValue({ json });
        const setHeader = jest.fn();
        return { res: { status, setHeader } as unknown as Response, status, json, setHeader };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockedAudit.recordAuditLog.mockResolvedValue(true);
        mockedAudit.getClientIp.mockReturnValue('10.0.0.1');
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    describe('getMyAccount', () => {
        it('returns 401 without a bearer token', async () => {
            const { res, status } = mockResponse();

            await getMyAccount(signedInRequest({ header: jest.fn(() => undefined) } as Partial<Request>), res);

            expect(status).toHaveBeenCalledWith(401);
            expect(mockedAccountServices.getAccountOverview).not.toHaveBeenCalled();
        });

        it('returns the account overview for the token owner', async () => {
            const { res, status, json } = mockResponse();
            const overview = { user: { userId: viewer.userId }, security: null };
            mockedAccountServices.getAccountOverview.mockResolvedValue(overview as never);

            await getMyAccount(signedInRequest(), res);

            expect(mockedAccountServices.getAccountOverview).toHaveBeenCalledWith(viewer.userId, accessToken);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(overview);
        });

        it('returns 404 for a missing profile and 500 for other failures', async () => {
            const missing = mockResponse();
            mockedAccountServices.getAccountOverview.mockRejectedValueOnce(new AccountNotFoundError());
            await getMyAccount(signedInRequest(), missing.res);
            expect(missing.status).toHaveBeenCalledWith(404);

            const broken = mockResponse();
            mockedAccountServices.getAccountOverview.mockRejectedValueOnce(new Error('db down'));
            await getMyAccount(signedInRequest(), broken.res);
            expect(broken.status).toHaveBeenCalledWith(500);
        });
    });

    describe('updateMyProfile', () => {
        it('rejects an empty first name with a field error', async () => {
            const { res, status, json } = mockResponse();

            await updateMyProfile(signedInRequest({ body: { firstName: '   ', lastName: 'Mokoena' } }), res);

            expect(status).toHaveBeenCalledWith(400);
            expect(json).toHaveBeenCalledWith({
                message: 'Validation error',
                errors: [{ field: 'firstName', message: 'Enter your first name.' }],
            });
            expect(mockedAccountServices.updateProfile).not.toHaveBeenCalled();
        });

        it('rejects fields that cannot be changed here', async () => {
            const { res, status } = mockResponse();

            await updateMyProfile(signedInRequest({ body: { firstName: 'Thandi', lastName: 'M', email: 'new@example.com' } }), res);

            expect(status).toHaveBeenCalledWith(400);
            expect(mockedAccountServices.updateProfile).not.toHaveBeenCalled();
        });

        it('saves trimmed names and records the change', async () => {
            const { res, status, json } = mockResponse();
            const user = { userId: viewer.userId, firstName: 'Lerato', lastName: 'Dube' };
            mockedAccountServices.updateProfile.mockResolvedValue({
                user,
                previous: { firstName: 'Thandi', lastName: 'Mokoena' },
                changed: true,
            } as never);

            await updateMyProfile(signedInRequest({ body: { firstName: '  Lerato ', lastName: 'Dube  ' } }), res);

            expect(mockedAccountServices.updateProfile).toHaveBeenCalledWith(viewer.userId, { firstName: 'Lerato', lastName: 'Dube' });
            expect(mockedAudit.recordAuditLog).toHaveBeenCalledWith({
                userId: viewer.userId,
                actionType: 'UPDATE',
                targetTable: 'users',
                oldValue: { firstName: 'Thandi', lastName: 'Mokoena' },
                newValue: { firstName: 'Lerato', lastName: 'Dube' },
                ipAddress: '10.0.0.1',
            });
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({ message: 'Profile updated', user });
        });

        it('does not write an audit entry when nothing changed', async () => {
            const { res, status } = mockResponse();
            mockedAccountServices.updateProfile.mockResolvedValue({
                user: {},
                previous: { firstName: 'Thandi', lastName: 'Mokoena' },
                changed: false,
            } as never);

            await updateMyProfile(signedInRequest({ body: { firstName: 'Thandi', lastName: 'Mokoena' } }), res);

            expect(status).toHaveBeenCalledWith(200);
            expect(mockedAudit.recordAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('changeMyPassword', () => {
        const body = { currentPassword: 'OldPass123!', newPassword: 'NewPass456!', signOutOtherDevices: true };

        it('rejects a weak new password before calling Supabase', async () => {
            const { res, status, json } = mockResponse();

            await changeMyPassword(signedInRequest({ body: { ...body, newPassword: 'password' } }), res);

            expect(status).toHaveBeenCalledWith(400);
            expect(json.mock.calls[0][0].errors[0].field).toBe('newPassword');
            expect(mockedAccountServices.changePassword).not.toHaveBeenCalled();
        });

        it('changes the password and records it without storing any password', async () => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.changePassword.mockResolvedValue(undefined);

            await changeMyPassword(signedInRequest({ body }), res);

            expect(mockedAccountServices.changePassword).toHaveBeenCalledWith(viewer.userId, accessToken, body);
            const auditEntry = mockedAudit.recordAuditLog.mock.calls[0][0];
            expect(auditEntry).toMatchObject({ actionType: 'PASSWORD_CHANGE', newValue: { signedOutOtherDevices: true } });
            expect(JSON.stringify(auditEntry)).not.toContain('Pass');
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({ message: 'Password changed', signedOutOtherDevices: true });
        });

        it.each([
            [new CurrentPasswordIncorrectError(), 400, { code: 'INVALID_CURRENT_PASSWORD', field: 'currentPassword' }],
            [new PasswordRejectedError('WEAK_PASSWORD', 'too weak'), 400, { code: 'WEAK_PASSWORD', field: 'newPassword' }],
            [new PasswordNotAvailableError(), 409, { code: 'PASSWORD_NOT_AVAILABLE' }],
            [new ReauthenticationNeededError(), 409, { code: 'REAUTHENTICATION_NEEDED' }],
            [new Error('supabase down'), 500, { message: 'Internal server error' }],
        ])('maps %s to the right response', async (error, expectedStatus, expectedBody) => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.changePassword.mockRejectedValue(error);

            await changeMyPassword(signedInRequest({ body }), res);

            expect(status).toHaveBeenCalledWith(expectedStatus);
            expect(json).toHaveBeenCalledWith(expect.objectContaining(expectedBody));
            expect(mockedAudit.recordAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('signOutAllDevices', () => {
        it('ends every session and records it', async () => {
            const { res, status, json } = mockResponse();
            mockedAccountServices.signOutEverywhere.mockResolvedValue(undefined);

            await signOutAllDevices(signedInRequest(), res);

            expect(mockedAccountServices.signOutEverywhere).toHaveBeenCalledWith(accessToken);
            expect(mockedAudit.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'LOGOUT_ALL_DEVICES' }));
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith({ message: 'Signed out of all devices' });
        });

        it('returns 500 when Supabase refuses', async () => {
            const { res, status } = mockResponse();
            mockedAccountServices.signOutEverywhere.mockRejectedValue(new Error('refused'));

            await signOutAllDevices(signedInRequest(), res);

            expect(status).toHaveBeenCalledWith(500);
            expect(mockedAudit.recordAuditLog).not.toHaveBeenCalled();
        });
    });

    describe('exportMyData', () => {
        it('sends the export as a dated JSON attachment', async () => {
            const { res, status, json, setHeader } = mockDownloadResponse();
            const exportData = { exportedAt: '2026-10-25T08:00:00.000Z', activity: { total: 3, included: 3, items: [] } };
            mockedAccountServices.buildPersonalDataExport.mockResolvedValue(exportData as never);

            await exportMyData(signedInRequest(), res);

            expect(mockedAccountServices.buildPersonalDataExport).toHaveBeenCalledWith(viewer.userId, accessToken);
            expect(setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="optigrid-my-data-2026-10-25.json"');
            expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
            expect(mockedAudit.recordAuditLog).toHaveBeenCalledWith(expect.objectContaining({
                actionType: 'DATA_EXPORT',
                newValue: { activityIncluded: 3 },
            }));
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(exportData);
        });

        it('returns 404 for a missing profile', async () => {
            const { res, status } = mockDownloadResponse();
            mockedAccountServices.buildPersonalDataExport.mockRejectedValue(new AccountNotFoundError());

            await exportMyData(signedInRequest(), res);

            expect(status).toHaveBeenCalledWith(404);
        });
    });
});
