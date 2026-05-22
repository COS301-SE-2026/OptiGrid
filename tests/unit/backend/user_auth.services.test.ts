import * as authServices from '../../../backend/core/src/services/user_auth.services';
import prisma from '../../../backend/core/src/lib/prisma';
import { createClient } from '@supabase/supabase-js';

// Mock profile lookup queries executed after Supabase sign-in succeeds.
jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
        },
    },
}));

// Mock Supabase client to control auth responses per test.
jest.mock('@supabase/supabase-js', () => ({
    __esModule: true,
    createClient: jest.fn(),
}));

// Typed handles for configuring mocks and assertions.
const mockedPrisma = prisma as unknown as {
    user: {
        findUnique: jest.Mock;
    };
};

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
// Supabase method used by login service.
const mockSignInWithPassword = jest.fn();

describe('User Authentication Service - Login', () => {
    const originalEnv = process.env;
    const mockUser = {
        userId: 'uuid-1234',
        email: 'test@testing.com',
        firstName: 'Test',
        lastName: 'User',
    };

    beforeEach(() => {
        // Login service requires public Supabase URL + anon key.
        process.env = {
            ...originalEnv,
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
        };

        // Return only the auth surface needed by login service.
        mockedCreateClient.mockReturnValue({
            auth: {
                signInWithPassword: mockSignInWithPassword,
            },
        } as unknown as ReturnType<typeof createClient>);
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    it('should login successfully with valid credentials', async () => {
        // Auth succeeds and returns canonical Supabase user id.
        mockSignInWithPassword.mockResolvedValue({
            data: {
                user: {
                    id: 'uuid-1234',
                },
                session: {
                    access_token: 'token-123',
                },
            },
            error: null,
        });
        mockedPrisma.user.findUnique.mockResolvedValue(mockUser);

        const result = await authServices.login('test@testing.com', 'password1234');

        expect(mockSignInWithPassword).toHaveBeenCalledWith({
            email: 'test@testing.com',
            password: 'password1234',
        });
        // App profile lookup must be keyed by authenticated auth user id.
        expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
            where: { userId: 'uuid-1234' },
            select: {
                userId: true,
                email: true,
                firstName: true,
                lastName: true,
            },
        });
        expect(result).toEqual({
            user: mockUser,
            accessToken: 'token-123',
        });
    });

    it('should throw an error if credentials are invalid', async () => {
        // Supabase invalid_credentials should map to the public invalid-login error message.
        mockSignInWithPassword.mockResolvedValue({
            data: {
                user: null,
            },
            error: {
                code: 'invalid_credentials',
                message: 'Invalid login credentials',
            },
        });

        await expect(authServices.login('test@testing.com', 'wrongpassword')).rejects.toThrow('Invalid email or password');
        expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should throw an error if authenticated profile is missing', async () => {
        // Even with valid auth, missing local profile should fail explicitly.
        mockSignInWithPassword.mockResolvedValue({
            data: {
                user: {
                    id: 'uuid-1234',
                },
                session: {
                    access_token: 'token-123',
                },
            },
            error: null,
        });
        mockedPrisma.user.findUnique.mockResolvedValue(null);

        await expect(authServices.login('test@testing.com', 'password1234')).rejects.toThrow('Authenticated user profile not found.');
    });
});
