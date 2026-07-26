import type { NextFunction, Request, Response } from 'express';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
        },
    },
}));

jest.mock('@supabase/supabase-js', () => ({
    __esModule: true,
    createClient: jest.fn(),
}));

describe('authenticateRequest account lifecycle guard', () => {
    const originalEnv = process.env;

    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    it('rejects a valid token when its application profile is deactivated', async () => {
        process.env = {
            ...originalEnv,
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
        };

        const { createClient } = require('@supabase/supabase-js') as {
            createClient: jest.Mock;
        };
        const getUser = jest.fn().mockResolvedValue({
            data: { user: { id: '11111111-1111-4111-8111-111111111111', user_metadata: {} } },
            error: null,
        });
        createClient.mockReturnValue({ auth: { getUser } });

        const prisma = require('../../../backend/core/src/lib/prisma').default as {
            user: { findUnique: jest.Mock };
        };
        prisma.user.findUnique.mockResolvedValue({
            tenantId: '22222222-2222-4222-8222-222222222222',
            roleType: 'VIEWER',
            accountStatus: 'DEACTIVATED',
        });

        const { authenticateRequest } = require('../../../backend/core/src/middleware/auth.middleware') as typeof import('../../../backend/core/src/middleware/auth.middleware');
        const status = jest.fn().mockReturnThis();
        const json = jest.fn();
        const response = { status, json } as unknown as Response;
        const next = jest.fn() as NextFunction;
        const request = {
            header: jest.fn().mockReturnValue('Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature'),
        } as unknown as Request;

        await authenticateRequest(request, response, next);

        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'ACCOUNT_DEACTIVATED',
        }));
        expect(next).not.toHaveBeenCalled();
    });
});
