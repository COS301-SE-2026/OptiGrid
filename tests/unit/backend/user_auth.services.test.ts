import * as authServices from '../../../backend/core/src/services/user_auth.services';
import prisma from '../../../backend/core/src/lib/prisma';
import {Prisma} from "@prisma/client";
import { createClient } from '@supabase/supabase-js';

// Mock profile lookup queries executed after Supabase sign-in succeeds.
jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
            update: jest.fn(),
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
        upsert: jest.Mock;
        update: jest.Mock;
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
        roleType: "VIEWER" as const
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
        //needed for the updateUserByRetry func
        mockedPrisma.user.update.mockClear();
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
                roleType: true,
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
        expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
    });

    it('should create a profile if authenticated profile is missing', async () => {
        // Valid auth can repair a missing local app profile.
        const repairedUser = {
            userId: 'uuid-1234',
            email: 'test@testing.com',
            firstName: '',
            lastName: '',
            roleType: "VIEWER",
        };
        mockSignInWithPassword.mockResolvedValue({
            data: {
                user: {
                    id: 'uuid-1234',
                    email: 'test@testing.com',
                },
                session: {
                    access_token: 'token-123',
                },
            },
            error: null,
        });
        mockedPrisma.user.findUnique.mockResolvedValue(null);
        mockedPrisma.user.upsert.mockResolvedValue(repairedUser);

        await expect(authServices.login('test@testing.com', 'password1234')).resolves.toEqual({
            user: repairedUser,
            accessToken: 'token-123',
        });
        expect(mockedPrisma.user.upsert).toHaveBeenCalledWith({
            where: {
                userId: 'uuid-1234',
            },
            create: {
                userId: 'uuid-1234',
                email: 'test@testing.com',
                firstName: '',
                lastName: '',
                roleType: "VIEWER"
            },
            update: {
                email: 'test@testing.com',
                firstName: '',
                lastName: '',
                roleType:"VIEWER"
            },
            select: {
                userId: true,
                email: true,
                firstName: true,
                lastName: true,
                roleType: true,
            },
        });
    });
    it("should_identify_P2003_errors_as_defined_in_isUserIdForeignKeyError", () => {
        const err = new Prisma.PrismaClientKnownRequestError("FK Error", {
            code: "P2003",
            clientVersion: "1.0",
            meta: {
                field_name: "users_user_id_fkey"
            }
        });
        //act n assert
        expect(authServices.isUserIdForeignKeyError(err)).toBe(true);
        expect(authServices.isUserIdForeignKeyError(new Error("some error with users_user_id_fkey inside"))).toBe(true);
        //this should return false because it doesnt account for that case
        expect(authServices.isUserIdForeignKeyError(new Error("Database Timeout"))).toBe(false);
    });

    it("should_identify_p2002_error", async () => {
        const err = new Prisma.PrismaClientKnownRequestError("Unique error", {
            code: "P2002",
            clientVersion: "1.0",
            meta: {
                target: ["user_id"]
            }
        });
        //act n assert
        expect(authServices.isUserIdUniqueConstraintError(err)).toBe(true);
        expect(authServices.isUserIdUniqueConstraintError(new Error("Database error: Unique constraint failed on the fields: (`user_id`)"))).toBe(true);
        //this should return false because it doesnt account for that case
        expect(authServices.isUserIdUniqueConstraintError(new Error("Database Timeout"))).toBe(false);
    });

    it("should_identify_P2025_error", async () => {
        const err = new Prisma.PrismaClientKnownRequestError("Not found ", {
            code: "P2025",
            clientVersion: "1.0",
        });
        //act n assert
        expect(authServices.isRecordNotFoundError(err)).toBe(true);
        //this should return false because it doesnt account for that case
        expect(authServices.isUserIdUniqueConstraintError(new Error("Database Timeout"))).toBe(false);
    });

    it("should_update_successfully_without_retrying", async () => {
        mockedPrisma.user.update.mockResolvedValueOnce(mockUser);
        //act
        const out = await authServices.updateUserByUserIdWithRetry(mockUser);
        //assert
        expect(out).toEqual(mockUser);
        expect(mockedPrisma.user.update).toHaveBeenCalled();
    });

    it("should_retry_if_error_is_P2025", async () => {
        const err = new Prisma.PrismaClientKnownRequestError("Not found ", {
            code: "P2025",
            clientVersion: "1.0",
        });
        mockedPrisma.user.update.mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockResolvedValue(mockUser);
        //act
        const out = await authServices.updateUserByUserIdWithRetry(mockUser);
        //assert
        expect(out).toEqual(mockUser);
        expect(mockedPrisma.user.update).toHaveBeenCalledTimes(3);
    });

    it("should_not_rety_if_not_P2025_error", async () => {
        mockedPrisma.user.update.mockRejectedValueOnce(new Error("No conn"));
        //act n assert
        await expect(authServices.updateUserByUserIdWithRetry(mockUser)).rejects
        .toThrow("No conn");
    })
});
