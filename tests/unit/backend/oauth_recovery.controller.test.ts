import { Request, Response } from 'express';
import { recoverOAuthAccountController } from '../../../backend/core/src/controllers/user_auth.controller';
import { AccountAlreadyActiveError, AccountNotFoundError } from '../../../backend/core/src/errors/account.errors';
import * as authServices from '../../../backend/core/src/services/user_auth.services';

jest.mock('../../../backend/core/src/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('../../../backend/core/src/services/user_auth.services');
jest.mock('../../../backend/core/src/services/auditLog.service', () => ({
    recordAuditLog: jest.fn().mockResolvedValue(true),
    getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
}));

const mockedRecover = authServices.recoverOAuthAccount as jest.Mock;

function respond() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status } as unknown as Response, status, json };
}

describe('recoverOAuthAccountController', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns 400 when no access token is sent', async () => {
        const { res, status } = respond();
        await recoverOAuthAccountController({ body: {} } as Request, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(mockedRecover).not.toHaveBeenCalled();
    });

    it('returns the recovered account and token', async () => {
        const { res, status, json } = respond();
        mockedRecover.mockResolvedValue({ user: { userId: 'user-1' }, accessToken: 'google-token' });

        await recoverOAuthAccountController({ body: { access: 'google-token' } } as Request, res);

        expect(mockedRecover).toHaveBeenCalledWith('google-token');
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({
            message: 'Account recovered successfully',
            user: { userId: 'user-1' },
            accessToken: 'google-token',
        });
    });

    it.each([
        [new AccountAlreadyActiveError(), 409],
        [new AccountNotFoundError(), 404],
        [new Error('Invalid or expired access token'), 401],
        [new Error('Database down'), 500],
    ])('maps %s to status %i', async (error, code) => {
        const { res, status } = respond();
        mockedRecover.mockRejectedValue(error);

        await recoverOAuthAccountController({ body: { access: 'google-token' } } as Request, res);
        expect(status).toHaveBeenCalledWith(code);
    });
});