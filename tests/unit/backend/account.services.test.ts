import { AccountStatus, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import prisma from '../../../backend/core/src/lib/prisma';
import {
    deactivateAccount,
    permanentlyDeleteAccount,
} from '../../../backend/core/src/services/account.services';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
        },
    },
}));

jest.mock('@supabase/supabase-js', () => ({
    __esModule: true,
    createClient: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
    user: {
        findUnique: jest.Mock;
        update: jest.Mock;
        count: jest.Mock;
        delete: jest.Mock;
    };
};
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockDeleteUser = jest.fn();

const viewer = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'viewer@example.com',
    firstName: 'Viewer',
    lastName: 'User',
    roleType: UserRole.VIEWER,
    accountStatus: AccountStatus.ACTIVE,
    deactivatedAt: null,
};

describe('account service', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        };
        mockDeleteUser.mockResolvedValue({ error: null });
        mockedCreateClient.mockReturnValue({
            auth: { admin: { deleteUser: mockDeleteUser } },
        } as unknown as ReturnType<typeof createClient>);
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    it('soft-deletes an active account while retaining its profile', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(viewer);
        mockedPrisma.user.update.mockResolvedValue({
            ...viewer,
            accountStatus: AccountStatus.DEACTIVATED,
            deactivatedAt: new Date('2026-07-23T12:00:00.000Z'),
        });

        const result = await deactivateAccount(viewer.userId);

        expect(result.accountStatus).toBe(AccountStatus.DEACTIVATED);
        expect(mockedPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { userId: viewer.userId },
            data: expect.objectContaining({
                accountStatus: AccountStatus.DEACTIVATED,
                deactivatedAt: expect.any(Date),
            }),
        }));
    });

    it('permanently deletes a non-admin from Supabase Auth and the app profile', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(viewer);
        mockedPrisma.user.delete.mockResolvedValue(viewer);

        await expect(
            permanentlyDeleteAccount('22222222-2222-4222-8222-222222222222', viewer.userId),
        ).resolves.toEqual(viewer);

        expect(mockDeleteUser).toHaveBeenCalledWith(viewer.userId);
        expect(mockedPrisma.user.delete).toHaveBeenCalledWith({
            where: { userId: viewer.userId },
        });
    });

    it('protects the final active administrator from permanent deletion', async () => {
        const admin = { ...viewer, roleType: UserRole.ADMIN };
        mockedPrisma.user.findUnique.mockResolvedValue(admin);
        mockedPrisma.user.count.mockResolvedValue(1);

        await expect(
            permanentlyDeleteAccount('22222222-2222-4222-8222-222222222222', admin.userId),
        ).rejects.toThrow('The last active administrator cannot be permanently deleted.');

        expect(mockDeleteUser).not.toHaveBeenCalled();
        expect(mockedPrisma.user.delete).not.toHaveBeenCalled();
    });
});
