import express from 'express';
import request from 'supertest';
import userAuthRoutes from '../../../backend/core/src/routes/user_auth.routes';
import * as authServices from '../../../backend/core/src/services/user_auth.services';

jest.mock('../../../backend/core/src/services/user_auth.services', () => ({
    signup: jest.fn(),
    login: jest.fn(),
    recoverAccount: jest.fn(),
    getManagersService: jest.fn(),
    getViewersService: jest.fn(),
    assignManagerService: jest.fn(),
    removeManagerService: jest.fn(),
}));

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findMany: jest.fn(),
            update: jest.fn(),
        },
    },
}));

jest.mock('../../../backend/core/src/middleware/auth.middleware', () => ({
    authenticateRequest: jest.fn((_req, _res, next) => next()),
}));

jest.mock('../../../backend/core/src/middleware/rbac.middleware', () => ({
    reqRole: jest.fn(() => (_req, _res, next) => next()),
}));

const mockedAuthServices = authServices as jest.Mocked<typeof authServices>;

function createAuthApp() {
    const app = express();
    app.use(express.json());
    app.use('/auth', userAuthRoutes);
    return app;
}

describe('user auth routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rejects recover account requests with an invalid email', async () => {
        const response = await request(createAuthApp())
            .post('/auth/recover-account')
            .send({ email: 'not-an-email', password: 'password123' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            message: 'Validation error',
            errors: [
                {
                    field: 'email',
                    message: 'Invalid email address',
                },
            ],
        });
        expect(mockedAuthServices.recoverAccount).not.toHaveBeenCalled();
    });

    it('rejects recover account requests without a password', async () => {
        const response = await request(createAuthApp())
            .post('/auth/recover-account')
            .send({ email: 'test@example.com' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation error');
        expect(response.body.errors).toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'password' }),
        ]));
        expect(mockedAuthServices.recoverAccount).not.toHaveBeenCalled();
    });

    it('rejects recover account requests with unexpected fields', async () => {
        const response = await request(createAuthApp())
            .post('/auth/recover-account')
            .send({
                email: 'test@example.com',
                password: 'password123',
                roleType: 'ADMIN',
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation error');
        expect(mockedAuthServices.recoverAccount).not.toHaveBeenCalled();
    });

    it('accepts a valid recover account request', async () => {
        mockedAuthServices.recoverAccount.mockResolvedValue({
            user: {
                userId: '11111111-1111-4111-8111-111111111111',
                email: 'test@example.com',
                firstName: 'Test',
                lastName: 'User',
                roleType: 'VIEWER',
            },
            accessToken: 'recovery-token',
        });

        const response = await request(createAuthApp())
            .post('/auth/recover-account')
            .send({ email: 'test@example.com', password: 'password123' });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Account recovered successfully');
        expect(mockedAuthServices.recoverAccount).toHaveBeenCalledWith(
            'test@example.com',
            'password123',
        );
    });
});
