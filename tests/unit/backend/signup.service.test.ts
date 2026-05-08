import prisma from '../../../backend/core/src/lib/prisma';
import { hashPassword } from '../../../backend/core/src/lib/password';
import { signup } from '../../../backend/core/src/services/user_auth.services';

//so this jest.mock is used to mock prisma client
jest.mock('../../../backend/core/src/lib/prisma', () => ({
	__esModule: true,
	default: {
		user: {
			findUnique: jest.fn(),
			create: jest.fn(),
		},
	},
}));

//this one is used to mock hpassword hashing 
jest.mock('../../../backend/core/src/lib/password', () => ({
	__esModule: true,
	hashPassword: jest.fn(),
}));

//this one is used to mock crypto.randomUUID to return a consistent user ID for testing
jest.mock('crypto', () => ({
	randomUUID: jest.fn(() => 'test-user-id'),
}));

//so this is to get mocked Prisma 
const mockedPrisma = prisma as unknown as {
	user: {
		findUnique: jest.Mock;
		create: jest.Mock;
	};
};

//this is mocked password 
const mockedHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;

/**this test suite is for signup/rgister logic, we test that when a user is created, it is succesful,
and when a user with the same email already exists, it throws an error**/
describe('signup service', () => {
	afterEach(() => {
		jest.clearAllMocks();
	});

	it('creates a user when the email is new and not sused', async () => {
		// Arrange
		mockedPrisma.user.findUnique.mockResolvedValue(null);
		mockedHashPassword.mockResolvedValue('hashed-password');
		mockedPrisma.user.create.mockResolvedValue({
			userId: 'test-user-id',
			email: 'user@example.com',
			firstName: 'Jane',
			lastName: 'Doe',
		});

		// Act
		const user = await signup('user@example.com', 'SecurePass123!', 'Jane Doe');

		// Assert
		expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
			where: { email: 'user@example.com' },
		});
		expect(mockedHashPassword).toHaveBeenCalledWith('SecurePass123!');
		expect(mockedPrisma.user.create).toHaveBeenCalledWith({
			data: {
				userId: 'test-user-id',
				email: 'user@example.com',
				passwordHash: 'hashed-password',
				firstName: 'Jane',
				lastName: 'Doe',
			},
			select: {
				userId: true,
				email: true,
				firstName: true,
				lastName: true,
			},
		});
		expect(user).toEqual({
			userId: 'test-user-id',
			email: 'user@example.com',
			firstName: 'Jane',
			lastName: 'Doe',
		});
	});

	it('throws an error when the email already exists', async () => {
		// Arrange
		mockedPrisma.user.findUnique.mockResolvedValue({ userId: 'existing-user' });

		// Act
		await expect(
			signup('user@example.com', 'SecurePass123!', 'Jane Doe'),
		).rejects.toThrow('User already exists, please login instead.');

		// Assert
		expect(mockedHashPassword).not.toHaveBeenCalled();
		expect(mockedPrisma.user.create).not.toHaveBeenCalled();
	});
});