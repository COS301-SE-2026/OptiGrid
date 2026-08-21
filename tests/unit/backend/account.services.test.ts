import { AccountStatus, Prisma, UserRole } from '@prisma/client';
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

    it('returns an already deactivated account without updating it again', async () => {
        const deactivatedViewer = {
            ...viewer,
            accountStatus: AccountStatus.DEACTIVATED,
            deactivatedAt: new Date('2026-07-23T12:00:00.000Z'),
        };
        mockedPrisma.user.findUnique.mockResolvedValue(deactivatedViewer);

        await expect(deactivateAccount(viewer.userId)).resolves.toEqual(deactivatedViewer);
        expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects deactivation when the account profile does not exist', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(null);

        await expect(deactivateAccount(viewer.userId)).rejects.toThrow('Account profile was not found.');
        expect(mockedPrisma.user.update).not.toHaveBeenCalled();
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

    it('blocks administrators from permanently deleting themselves', async () => {
        await expect(
            permanentlyDeleteAccount(viewer.userId, viewer.userId),
        ).rejects.toThrow('Administrators cannot permanently delete their own account.');

        expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
        expect(mockDeleteUser).not.toHaveBeenCalled();
        expect(mockedPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('rejects permanent deletion when the target account does not exist', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(null);

        await expect(
            permanentlyDeleteAccount('22222222-2222-4222-8222-222222222222', viewer.userId),
        ).rejects.toThrow('Account profile was not found.');

        expect(mockDeleteUser).not.toHaveBeenCalled();
        expect(mockedPrisma.user.delete).not.toHaveBeenCalled();
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

    it('does not delete the app profile when Supabase Auth deletion fails', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(viewer);
        mockDeleteUser.mockResolvedValue({
            error: { message: 'auth user delete failed' },
        });

        await expect(
            permanentlyDeleteAccount('22222222-2222-4222-8222-222222222222', viewer.userId),
        ).rejects.toThrow('Failed to permanently delete auth user: auth user delete failed');

        expect(mockedPrisma.user.delete).not.toHaveBeenCalled();
    });

    it('throws when the app profile deletion fails with a database error', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue(viewer);
        mockedPrisma.user.delete.mockRejectedValue(new Error('database unavailable'));

        await expect(
            permanentlyDeleteAccount('22222222-2222-4222-8222-222222222222', viewer.userId),
        ).rejects.toThrow('database unavailable');
    });

    it('treats a missing app profile after Supabase deletion as a successful cascade', async () => {
        const alreadyDeletedError = new Prisma.PrismaClientKnownRequestError('Record not found', {
            code: 'P2025',
            clientVersion: '1.0.0',
        });
        mockedPrisma.user.findUnique.mockResolvedValue(viewer);
        mockedPrisma.user.delete.mockRejectedValue(alreadyDeletedError);

        await expect(
            permanentlyDeleteAccount('22222222-2222-4222-8222-222222222222', viewer.userId),
        ).resolves.toEqual(viewer);
    });
});
