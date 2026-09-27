import prisma from '../../../backend/core/src/lib/prisma';
import { signup } from '../../../backend/core/src/services/user_auth.services';
import { createClient } from '@supabase/supabase-js';

// Mock Prisma user delegate used by signup profile persistence.
jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		user: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
		},
	},
}));

// Mock Supabase admin client used to provision auth users.
jest.mock('@supabase/supabase-js', () => ({
	__esModule: true,
	createClient: jest.fn(),
}));

// Typed handles for easier test setup and expectations.
const mockedPrisma = prisma as unknown as {
	user: {
		findUnique: jest.Mock;
		upsert: jest.Mock;
	};
};

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// Supabase admin methods exercised by signup service.
const mockCreateUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockSignInWithPassword = jest.fn();

// Signup tests validate both auth provisioning and profile persistence behavior.
describe('signup service', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Service expects admin credentials to build the Supabase admin client.
		process.env = {
			...originalEnv,
			SUPABASE_URL: 'https://example.supabase.co',
			SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
			SUPABASE_ANON_KEY: 'anon-key',
		};

		mockCreateUser.mockResolvedValue({
			data: { user: { id: 'supabase-user-id' } },
			error: null,
		});
		// Cleanup is invoked on certain failure paths; keep a default success response here.
		mockDeleteUser.mockResolvedValue({ error: null });

		// Return a minimal Supabase client surface used by signup.
		mockedCreateClient.mockReturnValue({
				auth: {
					signInWithPassword: mockSignInWithPassword,
					admin: {
					createUser: mockCreateUser,
					deleteUser: mockDeleteUser,
				},
			},
		} as unknown as ReturnType<typeof createClient>);
	});

	afterEach(() => {
		jest.clearAllMocks();
		process.env = originalEnv;
	});

	it('creates a user when the email is new and not sused', async () => {
		// Arrange
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockedPrisma.user.upsert.mockResolvedValue({
			userId: 'supabase-user-id',
			email: 'user@example.com',
			firstName: 'Jane',
			lastName: 'Doe',
			roleType: "VIEWER,"
		});

		// Act
		const user = await signup('user@example.com', 'SecurePass123!', 'Jane Doe');

		// Assert: auth user is provisioned first, then app profile is upserted with same user id.
		expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
			where: { email: 'user@example.com' },
			select: {
				userId: true,
			},
		});
		expect(mockCreateUser).toHaveBeenCalledWith({
			email: 'user@example.com',
			password: 'SecurePass123!',
			email_confirm: true,
		});
		expect(mockedPrisma.user.upsert).toHaveBeenCalledWith({
			where: {
				userId: 'supabase-user-id',
			},
			create: {
				userId: 'supabase-user-id',
				email: 'user@example.com',
				firstName: 'Jane',
				lastName: 'Doe',
				roleType: "VIEWER"
			},
			update: {
				email: 'user@example.com',
				firstName: 'Jane',
				lastName: 'Doe',
				roleType: "VIEWER"
			},
			select: {
				userId: true,
				email: true,
				firstName: true,
				lastName: true,
				roleType: true,
			},
		});
		expect(user).toEqual({
			userId: 'supabase-user-id',
			email: 'user@example.com',
			firstName: 'Jane',
			lastName: 'Doe',
			roleType: "VIEWER,"
		});
	});

	it('throws an error when the email already exists', async () => {
		// Arrange
		mockedPrisma.user.findUnique.mockResolvedValue({ userId: 'existing-user' });

		// Act
		await expect(
			signup('user@example.com', 'SecurePass123!', 'Jane Doe'),
		).rejects.toThrow('User already exists, please login instead.');

		// Assert: no auth provisioning or profile writes occur for duplicate email.
		expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
	});

	it('reuses an existing auth identity when Supabase reports a duplicate and credentials match', async () => {
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockCreateUser.mockResolvedValue({ data: { user: null }, error: { code: 'USER_ALREADY_EXISTS' } });
		mockSignInWithPassword.mockResolvedValue({
			data: { user: { id: 'existing-auth-id', email: 'user@example.com' }, session: { access_token: 'token' } },
			error: null,
		});
		mockedPrisma.user.upsert.mockResolvedValue({ userId: 'existing-auth-id' });

		await expect(signup('user@example.com', 'SecurePass123!', 'Jane Doe'))
			.resolves.toEqual({ userId: 'existing-auth-id' });
		expect(mockedPrisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
			where: { userId: 'existing-auth-id' },
		}));
		expect(mockDeleteUser).not.toHaveBeenCalled();
	});

	it('reports an existing account when duplicate auth credentials do not match', async () => {
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockCreateUser.mockResolvedValue({ data: { user: null }, error: { message: 'Already registered' } });
		mockSignInWithPassword.mockResolvedValue({
			data: { user: null, session: null },
			error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
		});
		await expect(signup('user@example.com', 'wrong-password', 'Jane Doe'))
			.rejects.toThrow('User already exists, please login instead.');
		expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
	});

	it('propagates a non-credential auth failure when resolving a duplicate identity', async () => {
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockCreateUser.mockResolvedValue({ data: { user: null }, error: { code: 'user_already_exists' } });
		mockSignInWithPassword.mockResolvedValue({
			data: { user: null, session: null }, error: { message: 'service unavailable' },
		});
		await expect(signup('user@example.com', 'SecurePass123!', 'Jane Doe'))
			.rejects.toThrow('Failed to authenticate user: service unavailable');
	});

	it('reports an unexpected Supabase provisioning failure', async () => {
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockCreateUser.mockResolvedValue({ data: { user: null }, error: { message: 'rate limit exceeded' } });
		await expect(signup('user@example.com', 'SecurePass123!', 'Jane Doe'))
			.rejects.toThrow('Failed to provision auth user: rate limit exceeded');
		expect(mockSignInWithPassword).not.toHaveBeenCalled();
	});

	it('logs rollback failure while preserving the profile write error', async () => {
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockedPrisma.user.upsert.mockRejectedValue(new Error('database unavailable'));
		mockDeleteUser.mockResolvedValue({ error: { message: 'delete denied' } });
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(signup('user@example.com', 'SecurePass123!', 'Jane Doe'))
				.rejects.toThrow('database unavailable');
		} finally {
			errorLog.mockRestore();
		}
		expect(mockDeleteUser).toHaveBeenCalledWith('supabase-user-id');
	});
});
