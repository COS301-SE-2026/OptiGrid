import * as authServices from '../../../backend/configuration/src/services/user_auth.services';
import prisma from '../../../backend/configuration/src/lib/prisma';
import { randomUUID } from 'crypto';
import {login} from '../../../backend/configuration/src/services/user_auth.services';
import { comparePass } from '../../../backend/configuration/src/lib/password';

//mocking prisma client
jest.mock('../../../backend/configuration/src/lib/prisma', () => ({
    user: {
        findUnique: jest.fn(),
    },
}));

//mock password comparison utility
jest.mock('../../../backend/configuration/src/lib/password', () => ({
    comparePass: jest.fn(),
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

    // Test Case 1: Successful login with valid credentials
    it("should login successfully with valid credentials", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (comparePass as jest.Mock).mockResolvedValue(true);

        const result = await authServices.login("test@testing.com", "password1234");
        expect(result).not.toHaveProperty("passwordHash");
    });

    // Test Case 2: Handle login with non-existent data 
    it("should throw an error if the user is not found", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        await expect(authServices.login("test@testing.com", "password1234")).rejects.toThrow("Invalid email or password");
    });

    // Test Case 3: Handle login with invalid password
    it("should throw an error if the password is incorrect", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
        (comparePass as jest.Mock).mockResolvedValue(false);
        await expect(authServices.login("test@testing.com", "password1234")).rejects.toThrow("Invalid email or password");
    });
});
