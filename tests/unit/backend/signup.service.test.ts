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

// Signup tests validate both auth provisioning and profile persistence behavior.
describe('signup service', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		// Service expects admin credentials to build the Supabase admin client.
		process.env = {
			...originalEnv,
			SUPABASE_URL: 'https://example.supabase.co',
			SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
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
});
