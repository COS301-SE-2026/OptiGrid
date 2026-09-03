if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/optigrid_test?schema=public";
}
import request from 'supertest';
import { UserRole } from '@prisma/client';
import { createApp } from '../../../backend/core/src/app';
import * as accountServices from '../../../backend/core/src/services/account.services';

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
}));

const mockedAccountServices = accountServices as jest.Mocked<typeof accountServices>;

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
});
