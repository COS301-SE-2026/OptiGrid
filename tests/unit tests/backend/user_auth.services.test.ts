import * as authServices from '../../core/src/services/user_auth.services';
import prisma from '../../core/src/utils/prismaClient';
import { comparePassword } from '../../core/src/utils/passwordUtils';

jest.mock('../../core/src/utils/prismaClient', () => ({
    user: {
        findUnique: jest.fn(),
    },
}));

jest.mock('../../core/src/utils/passwordUtils', () => ({
    comparePassword: jest.fn(),
}));

describe("User Authentication Service - Login", () => { 
    const mockUser = {
        userId: "uuid-1234",
        email: "test@testing.com",
        firstName: "Test",
        lastName: "User",
        passwordHash: "hashedpassword1234",
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should login successfully with valid credentials", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (comparePassword as jest.Mock).mockResolvedValue(true);

        const result = await authServices.login("test@testing.com", "password1234");
        expect(result).not.toHaveProperty("passwordHash");
    });

    it("should throw an error if the user is not found", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(authServices.login("test@testing.com", "password1234")).rejects.toThrow("Invalid email or password");
    });

    it("should throw an error if the password is comparison fails", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (comparePassword as jest.Mock).mockResolvedValue(false);
        await expect(authServices.login("test@testing.com", "password1234")).rejects.toThrow("Invalid email or password");
    });
});
