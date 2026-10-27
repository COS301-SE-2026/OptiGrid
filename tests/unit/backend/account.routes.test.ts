if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/optigrid_test?schema=public";
}
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { createApp } from '../../../backend/core/src/app';
import * as accountServices from '../../../backend/core/src/services/account.services';
import { rateLimiter } from '../../../backend/core/src/middleware/rateLimiter.middleware';

let mockAuthenticatedUser: {
    id: string;
    roleType: UserRole;
    user_metadata: Record<string, unknown>;
} = {
    id: '11111111-1111-4111-8111-111111111111',
    roleType: UserRole.ADMIN,
    user_metadata: {},
};

jest.mock('../../../backend/core/src/middleware/auth.middleware', () => ({
    authenticateRequest: jest.fn((req, _res, next) => {
        req.user = mockAuthenticatedUser;
        next();
    }),
}));

jest.mock('../../../backend/core/src/middleware/rateLimiter.middleware', () => ({
    rateLimiter: jest.fn(() => (_req, _res, next) => next()),
}));

jest.mock('../../../backend/core/src/routes/user_auth.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/routes/sensor.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/routes/building.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/routes/analytics.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/routes/user_preferences.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/routes/contact.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/routes/telemetry.routes', () => ({
    __esModule: true,
    default: jest.requireActual('express').Router(),
}));

jest.mock('../../../backend/core/src/services/account.services', () => ({
    deactivateAccount: jest.fn(),
    permanentlyDeleteAccount: jest.fn(),
    getAccountOverview: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    signOutEverywhere: jest.fn(),
    buildPersonalDataExport: jest.fn(),
}));

// keep these route tests from writing audit rows to a real database
jest.mock('../../../backend/core/src/services/auditLog.service', () => ({
    ...jest.requireActual('../../../backend/core/src/services/auditLog.service'),
    recordAuditLog: jest.fn(),
}));

const mockedAccountServices = accountServices as jest.Mocked<typeof accountServices>;
const limiterCalls = (rateLimiter as jest.Mock).mock.calls.map((call) => [...call]);

describe('account routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthenticatedUser = {
            id: '11111111-1111-4111-8111-111111111111',
            roleType: UserRole.ADMIN,
            user_metadata: {},
        };
    });

    it('mounts POST /api/accounts/me/deactivate', async () => {
        mockedAccountServices.deactivateAccount.mockResolvedValue({
            userId: mockAuthenticatedUser.id,
            email: 'viewer@example.com',
            firstName: 'Viewer',
            lastName: 'User',
            roleType: UserRole.VIEWER,
        } as never);

        const response = await request(createApp())
            .post('/api/accounts/me/deactivate')
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Account deactivated successfully');
        expect(mockedAccountServices.deactivateAccount).toHaveBeenCalledWith(mockAuthenticatedUser.id);
    });

    it('mounts DELETE /api/admin/users/:userId', async () => {
        const targetUserId = '22222222-2222-4222-8222-222222222222';
        mockedAccountServices.permanentlyDeleteAccount.mockResolvedValue({
            userId: targetUserId,
            email: 'viewer@example.com',
            firstName: 'Viewer',
            lastName: 'User',
            roleType: UserRole.VIEWER,
        } as never);

        const response = await request(createApp())
            .delete(`/api/admin/users/${targetUserId}`)
            .send({});

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Account permanently deleted');
        expect(mockedAccountServices.permanentlyDeleteAccount).toHaveBeenCalledWith(
            mockAuthenticatedUser.id,
            targetUserId,
        );
    });

    describe('self-service endpoints', () => {
        const bearer = 'Bearer token-123';

        it('mounts GET /api/accounts/me and passes the caller token on', async () => {
            mockedAccountServices.getAccountOverview.mockResolvedValue({
                user: { userId: mockAuthenticatedUser.id, firstName: 'Thandi' },
                security: null,
            } as never);

            const response = await request(createApp()).get('/api/accounts/me').set('Authorization', bearer);

            expect(response.status).toBe(200);
            expect(response.body.user.firstName).toBe('Thandi');
            expect(mockedAccountServices.getAccountOverview).toHaveBeenCalledWith(mockAuthenticatedUser.id, 'token-123');
        });

        it('mounts PUT /api/accounts/me with validation', async () => {
            const invalid = await request(createApp()).put('/api/accounts/me').set('Authorization', bearer).send({ firstName: '' });
            expect(invalid.status).toBe(400);
            expect(mockedAccountServices.updateProfile).not.toHaveBeenCalled();

            mockedAccountServices.updateProfile.mockResolvedValue({
                user: { firstName: 'Lerato', lastName: 'Dube' },
                previous: { firstName: 'Thandi', lastName: 'Mokoena' },
                changed: true,
            } as never);
            const saved = await request(createApp())
                .put('/api/accounts/me')
                .set('Authorization', bearer)
                .send({ firstName: 'Lerato', lastName: 'Dube' });

            expect(saved.status).toBe(200);
            expect(saved.body).toEqual({ message: 'Profile updated', user: { firstName: 'Lerato', lastName: 'Dube' } });
        });

        it('mounts POST /api/accounts/me/password', async () => {
            mockedAccountServices.changePassword.mockResolvedValue(undefined);

            const response = await request(createApp())
                .post('/api/accounts/me/password')
                .set('Authorization', bearer)
                .send({ currentPassword: 'OldPass123!', newPassword: 'NewPass456!' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ message: 'Password changed', signedOutOtherDevices: true });
            expect(mockedAccountServices.changePassword).toHaveBeenCalledWith(mockAuthenticatedUser.id, 'token-123', {
                currentPassword: 'OldPass123!',
                newPassword: 'NewPass456!',
            });
        });

        it('mounts POST /api/accounts/me/sign-out-everywhere', async () => {
            mockedAccountServices.signOutEverywhere.mockResolvedValue(undefined);

            const response = await request(createApp()).post('/api/accounts/me/sign-out-everywhere').set('Authorization', bearer);

            expect(response.status).toBe(200);
            expect(mockedAccountServices.signOutEverywhere).toHaveBeenCalledWith('token-123');
        });

        it('mounts GET /api/accounts/me/export as a download', async () => {
            mockedAccountServices.buildPersonalDataExport.mockResolvedValue({
                exportedAt: '2026-10-25T08:00:00.000Z',
                activity: { total: 0, included: 0, items: [] },
            } as never);

            const response = await request(createApp()).get('/api/accounts/me/export').set('Authorization', bearer);

            expect(response.status).toBe(200);
            expect(response.headers['content-disposition']).toBe('attachment; filename="optigrid-my-data-2026-10-25.json"');
            expect(response.headers['cache-control']).toBe('no-store');
        });

        it('gives password changes and exports their own rate limits', () => {
            expect(limiterCalls).toEqual(expect.arrayContaining([
                [5, 1 / 60, 'account-password'],
                [3, 1 / 60, 'account-export'],
            ]));
        });
    });
});
