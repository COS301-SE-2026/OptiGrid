import { AccountStatus, Prisma, ThemePreference, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import prisma from '../../../backend/core/src/lib/prisma';
import {
    buildPersonalDataExport,
    changePassword,
    deactivateAccount,
    EXPORT_ROW_LIMIT,
    getAccountOverview,
    permanentlyDeleteAccount,
    signOutEverywhere,
    updateProfile,
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
        notification: {
            count: jest.fn(),
            findMany: jest.fn(),
        },
        anomaly: {
            count: jest.fn(),
            findMany: jest.fn(),
        },
        auditLog: {
            count: jest.fn(),
            findMany: jest.fn(),
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
    notification: { count: jest.Mock; findMany: jest.Mock };
    anomaly: { count: jest.Mock; findMany: jest.Mock };
    auditLog: { count: jest.Mock; findMany: jest.Mock };
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

    it('refuses to deactivate the last active administrator', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue({ ...viewer, roleType: UserRole.ADMIN });
        mockedPrisma.user.count.mockResolvedValue(1);

        await expect(deactivateAccount(viewer.userId)).rejects.toMatchObject({ code: 'LAST_ACTIVE_ADMIN' });
        expect(mockedPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lets an administrator deactivate while another administrator stays active', async () => {
        const admin = { ...viewer, roleType: UserRole.ADMIN };
        mockedPrisma.user.findUnique.mockResolvedValue(admin);
        mockedPrisma.user.count.mockResolvedValue(2);
        mockedPrisma.user.update.mockResolvedValue({ ...admin, accountStatus: AccountStatus.DEACTIVATED });

        const result = await deactivateAccount(viewer.userId);
        expect(result.accountStatus).toBe(AccountStatus.DEACTIVATED);
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
        ).rejects.toThrow('The last active administrator cannot be removed. Make another user an administrator first.');

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

describe('account self-service', () => {
    const originalEnv = process.env;
    const accessToken = 'access-token-123';
    const profileRow = {
        userId: viewer.userId,
        email: viewer.email,
        firstName: 'Thandi',
        lastName: 'Mokoena',
        roleType: UserRole.BUILDING_MANAGER,
        preferredTheme: ThemePreference.SYSTEM,
        createdAt: new Date('2026-03-02T08:15:00.000Z'),
        updatedAt: new Date('2026-10-20T11:42:00.000Z'),
    };
    const emailUser = {
        id: viewer.userId,
        email: viewer.email,
        last_sign_in_at: '2026-10-25T07:58:12.000Z',
        app_metadata: { provider: 'email', providers: ['email'] },
        identities: [{ provider: 'email' }],
    };

    let auth: {
        getUser: jest.Mock;
        signInWithPassword: jest.Mock;
        updateUser: jest.Mock;
        admin: { signOut: jest.Mock; deleteUser: jest.Mock };
    };

    beforeEach(() => {
        process.env = {
            ...originalEnv,
            SUPABASE_URL: 'https://example.supabase.co',
            SUPABASE_ANON_KEY: 'anon-key',
        };
        auth = {
            getUser: jest.fn().mockResolvedValue({ data: { user: emailUser }, error: null }),
            signInWithPassword: jest.fn().mockResolvedValue({
                data: { user: { id: viewer.userId }, session: { access_token: 'verification-token' } },
                error: null,
            }),
            updateUser: jest.fn().mockResolvedValue({ data: { user: emailUser }, error: null }),
            admin: {
                signOut: jest.fn().mockResolvedValue({ data: null, error: null }),
                deleteUser: jest.fn(),
            },
        };
        mockedCreateClient.mockReturnValue({ auth } as unknown as ReturnType<typeof createClient>);
    });

    afterEach(() => {
        jest.clearAllMocks();
        process.env = originalEnv;
    });

    describe('getAccountOverview', () => {
        it('returns the saved profile with the sign-in details from Supabase', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(profileRow);

            const overview = await getAccountOverview(viewer.userId, accessToken);

            expect(auth.getUser).toHaveBeenCalledWith(accessToken);
            expect(overview.user).toEqual({
                ...profileRow,
                preferredTheme: 'system',
            });
            expect(overview.security).toEqual({
                signInMethods: ['email'],
                canChangePassword: true,
                lastSignInAt: '2026-10-25T07:58:12.000Z',
            });
        });

        it('marks Google-only accounts as unable to change a password', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(profileRow);
            auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        ...emailUser,
                        app_metadata: { provider: 'google', providers: ['google'] },
                        identities: [{ provider: 'google' }],
                    },
                },
                error: null,
            });

            const overview = await getAccountOverview(viewer.userId, accessToken);

            expect(overview.security).toMatchObject({ signInMethods: ['google'], canChangePassword: false });
        });

        it('still returns the profile when Supabase Auth cannot be reached', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue({ ...profileRow, firstName: null, lastName: null });
            auth.getUser.mockRejectedValue(new Error('network down'));

            const overview = await getAccountOverview(viewer.userId, accessToken);

            expect(overview.user.firstName).toBe('');
            expect(overview.user.lastName).toBe('');
            expect(overview.security).toBeNull();
        });

        it('rejects a missing profile', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(null);

            await expect(getAccountOverview(viewer.userId, accessToken)).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
        });
    });

    describe('updateProfile', () => {
        it('saves new names and reports the previous ones', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(profileRow);
            mockedPrisma.user.update.mockResolvedValue({ ...profileRow, firstName: 'Lerato', lastName: 'Dube' });

            const result = await updateProfile(viewer.userId, { firstName: 'Lerato', lastName: 'Dube' });

            expect(mockedPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { userId: viewer.userId },
                data: { firstName: 'Lerato', lastName: 'Dube', updatedAt: expect.any(Date) },
            }));
            expect(result.changed).toBe(true);
            expect(result.previous).toEqual({ firstName: 'Thandi', lastName: 'Mokoena' });
            expect(result.user).toMatchObject({ firstName: 'Lerato', lastName: 'Dube' });
        });

        it('skips the write when nothing changed', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(profileRow);

            const result = await updateProfile(viewer.userId, { firstName: 'Thandi', lastName: 'Mokoena' });

            expect(result.changed).toBe(false);
            expect(mockedPrisma.user.update).not.toHaveBeenCalled();
        });

        it('rejects a missing profile', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(null);

            await expect(updateProfile(viewer.userId, { firstName: 'A', lastName: '' })).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
        });
    });

    describe('changePassword', () => {
        const change = { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' };
        const originalFetch = global.fetch;
        let fetchMock: jest.Mock;

        function authReplies(status: number, body: unknown) {
            fetchMock.mockResolvedValue({
                ok: status >= 200 && status < 300,
                status,
                json: jest.fn().mockResolvedValue(body),
            });
        }

        beforeEach(() => {
            fetchMock = jest.fn();
            global.fetch = fetchMock as unknown as typeof fetch;
            authReplies(200, emailUser);
        });

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it('checks the current password, ends the check session, then sends the change with this device token', async () => {
            await expect(changePassword(viewer.userId, accessToken, change)).resolves.toBeUndefined();

            expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: viewer.email, password: 'OldPass123!' });
            expect(auth.admin.signOut).toHaveBeenCalledTimes(1);
            expect(auth.admin.signOut).toHaveBeenCalledWith('verification-token', 'local');
            expect(auth.updateUser).not.toHaveBeenCalled();

            const [url, init] = fetchMock.mock.calls[0];
            expect(String(url)).toBe('https://example.supabase.co/auth/v1/user');
            expect(init).toMatchObject({
                method: 'PUT',
                headers: { apikey: 'anon-key', Authorization: `Bearer ${accessToken}` },
            });
            expect(JSON.parse(init.body)).toEqual({ password: 'NewPass456!' });
            expect(auth.admin.signOut.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
        });

        it('keeps any path that the Supabase URL carries', async () => {
            process.env.SUPABASE_URL = 'https://gateway.example.com/supabase/';

            await changePassword(viewer.userId, accessToken, change);

            expect(String(fetchMock.mock.calls[0][0])).toBe('https://gateway.example.com/supabase/auth/v1/user');
        });

        it('rejects a wrong current password without touching the password', async () => {
            auth.signInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
            });

            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('refuses accounts that sign in with Google only', async () => {
            auth.getUser.mockResolvedValue({
                data: { user: { ...emailUser, app_metadata: { provider: 'google', providers: ['google'] }, identities: [] } },
                error: null,
            });

            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toMatchObject({ code: 'PASSWORD_NOT_AVAILABLE' });
            expect(auth.signInWithPassword).not.toHaveBeenCalled();
        });

        it.each([
            [{ code: 422, error_code: 'same_password', msg: 'New password should be different from the old password.' }, 'SAME_PASSWORD'],
            [{ code: 'weak_password', message: 'Password is known to be weak and easy to guess.' }, 'WEAK_PASSWORD'],
            [{ code: 400, error_code: 'reauthentication_needed', msg: 'Password update requires reauthentication' }, 'REAUTHENTICATION_NEEDED'],
        ])('turns the Supabase reply %j into %s', async (reply, code) => {
            authReplies(422, reply);

            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toMatchObject({ code });
            expect(auth.admin.signOut).toHaveBeenCalledWith('verification-token', 'local');
        });

        it('passes other refusals on with the Supabase message, or the status when there is none', async () => {
            authReplies(500, { msg: 'database unavailable' });
            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toThrow('Failed to update the password: database unavailable');

            fetchMock.mockResolvedValue({ ok: false, status: 502, json: jest.fn().mockRejectedValue(new SyntaxError('Unexpected token <')) });
            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toThrow('Supabase Auth answered 502');
        });

        it('stops when the check session belongs to another user', async () => {
            auth.signInWithPassword.mockResolvedValue({
                data: { user: { id: 'someone-else' }, session: { access_token: 'verification-token' } },
                error: null,
            });

            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toThrow('different session');
            expect(fetchMock).not.toHaveBeenCalled();
            expect(auth.admin.signOut).toHaveBeenCalledWith('verification-token', 'local');
        });

        it('raises other Supabase sign-in failures as server errors', async () => {
            auth.signInWithPassword.mockResolvedValue({
                data: { user: null, session: null },
                error: { code: 'over_request_rate_limit', message: 'Too many requests' },
            });

            await expect(changePassword(viewer.userId, accessToken, change)).rejects.toThrow('Failed to verify the current password');
        });
    });

    describe('signOutEverywhere', () => {
        it('revokes every session for the token owner', async () => {
            await signOutEverywhere(accessToken);

            expect(auth.admin.signOut).toHaveBeenCalledWith(accessToken, 'global');
        });

        it('throws when Supabase refuses', async () => {
            auth.admin.signOut.mockResolvedValue({ data: null, error: { message: 'nope' } });

            await expect(signOutEverywhere(accessToken)).rejects.toThrow('Failed to sign out of all devices: nope');
        });
    });

    describe('buildPersonalDataExport', () => {
        beforeEach(() => {
            mockedPrisma.user.findUnique.mockResolvedValue({
                ...profileRow,
                accountStatus: AccountStatus.ACTIVE,
                deactivatedAt: null,
                tenant: { companyName: 'Coreflow Properties', subscriptionTier: 'Standard' },
                buildingAccess: [{
                    building: {
                        building_id: 'b1',
                        building_name: 'Hatfield Plaza',
                        building_type: 'Commercial',
                        physical_address: '1 Burnett Street, Pretoria',
                    },
                }],
            });
            mockedPrisma.notification.count.mockResolvedValue(1);
            mockedPrisma.notification.findMany.mockResolvedValue([{
                notification_id: 'n1',
                anomaly_id: 'a1',
                channel: 'InApp',
                status: 'Sent',
                content: 'High anomaly detected',
                sent_at: new Date('2026-10-01T10:00:00.000Z'),
            }]);
            mockedPrisma.anomaly.count.mockResolvedValue(0);
            mockedPrisma.anomaly.findMany.mockResolvedValue([]);
            mockedPrisma.auditLog.count.mockResolvedValue(7200);
            mockedPrisma.auditLog.findMany.mockResolvedValue([{
                timestamp: new Date('2026-10-24T09:00:00.000Z'),
                action_type: 'LOGIN',
                target_table: 'users',
                building_id: null,
                ip_address: '10.0.0.1',
            }]);
        });

        it('collects only the records that belong to the user', async () => {
            const result = await buildPersonalDataExport(viewer.userId, accessToken);

            expect(result.account).toMatchObject({
                userId: viewer.userId,
                email: viewer.email,
                firstName: 'Thandi',
                role: UserRole.BUILDING_MANAGER,
                theme: 'system',
                status: AccountStatus.ACTIVE,
            });
            expect(result.signIn).toEqual({ methods: ['email'], lastSignInAt: '2026-10-25T07:58:12.000Z' });
            expect(result.organisation).toEqual({ name: 'Coreflow Properties', plan: 'Standard' });
            expect(result.buildingAccess).toEqual({
                scope: 'assigned buildings',
                buildings: [{ buildingId: 'b1', name: 'Hatfield Plaza', type: 'Commercial', address: '1 Burnett Street, Pretoria' }],
            });
            expect(result.notifications).toMatchObject({ total: 1, included: 1 });
            expect(result.activity).toMatchObject({ total: 7200, included: 1 });
            expect(result.activity.items[0]).toEqual({
                at: new Date('2026-10-24T09:00:00.000Z'),
                action: 'LOGIN',
                target: 'users',
                buildingId: null,
                ipAddress: '10.0.0.1',
            });
            expect(Date.parse(result.exportedAt)).not.toBeNaN();

            for (const delegate of [mockedPrisma.notification, mockedPrisma.auditLog]) {
                expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({
                    where: { user_id: viewer.userId },
                    take: EXPORT_ROW_LIMIT,
                }));
            }
            expect(mockedPrisma.anomaly.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { resolved_by_user_id: viewer.userId },
            }));
        });

        it('explains that administrators can open every building', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue({
                ...profileRow,
                roleType: UserRole.ADMIN,
                accountStatus: AccountStatus.ACTIVE,
                deactivatedAt: null,
                tenant: null,
                buildingAccess: [],
            });

            const result = await buildPersonalDataExport(viewer.userId, accessToken);

            expect(result.buildingAccess).toEqual({ scope: 'all buildings', buildings: [] });
            expect(result.organisation).toBeNull();
        });

        it('leaves out sign-in details when Supabase Auth is unavailable', async () => {
            auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'down' } });

            const result = await buildPersonalDataExport(viewer.userId, accessToken);

            expect(result.signIn).toBeNull();
        });

        it('rejects a missing profile', async () => {
            mockedPrisma.user.findUnique.mockResolvedValue(null);

            await expect(buildPersonalDataExport(viewer.userId, accessToken)).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
        });
    });
});
