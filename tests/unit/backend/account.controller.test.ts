import type { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import {
    AccountNotFoundError,
    LastActiveAdminError,
    SelfPermanentDeletionError,
} from '../../../backend/core/src/errors/account.errors';
import * as accountServices from '../../../backend/core/src/services/account.services';
import {
    deactivateMyAccount,
    permanentlyDeleteUser,
} from '../../../backend/core/src/controllers/account.controller';

jest.mock('../../../backend/core/src/services/account.services', () => ({
    deactivateAccount: jest.fn(),
    permanentlyDeleteAccount: jest.fn(),
}));

const mockedAccountServices = accountServices as jest.Mocked<typeof accountServices>;

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
