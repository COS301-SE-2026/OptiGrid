//mock prisma client

jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    })),
}));

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    },
}));

import { login, recoverAccount } from '../../../backend/core/src/controllers/user_auth.controller';
import * as authServices from '../../../backend/core/src/services/user_auth.services';
import { Request, Response } from 'express';
import {
    AccountAlreadyActiveError,
    AccountNotFoundError,
} from '../../../backend/core/src/errors/account.errors';

jest.mock("../../../backend/core/src/services/user_auth.services")

describe("User Authentication Controller - Login", () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        mockResponse = {
            status: statusMock,
        };
    });

    // Test Case 1: Missing required fields validation
    it("should return 400 if email or password is missing", async () => {
        mockRequest = { body: { email: "test@testing.com" } };
        await login(mockRequest as Request, mockResponse as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Email and password are required fields." });
    });

    // Test Case 2: Successful login flow
    it("should return 200 and user data on successful login", async () => {
        const mockSafeUser = { userId: '1', email: 'test@test.com', firstName: 'John', lastName: 'Doe' };
        const mockAccessToken = "test-access-token";
        mockRequest = { body: { email: "test@test.com", password: "password123" } };
        //mocking the service to return a successful user
        (authServices.login as jest.Mock).mockResolvedValue({ user: mockSafeUser, accessToken: mockAccessToken });
        await login(mockRequest as Request, mockResponse as Response);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Login successful", user: mockSafeUser, accessToken: mockAccessToken });
    });

    // Test Case 3: Handle invalid credentials
    it('should return 400 for "Invalid email or password" service error', async () => {
        mockRequest = { body: { email: "test@test.com", password: "wrongpassword" } };
        //simulating the specific service error
        (authServices.login as jest.Mock).mockRejectedValue(new Error("Invalid email or password"));
        await login(mockRequest as Request, mockResponse as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid email or password" });
    });

    // Test Case 4: Handle unexpected service errors
    it("should return 500 for unexpected service errors", async () => {
        mockRequest = { body: { email: "email@example.com", password: "password123" } };
        //simulating a generic server error
        (authServices.login as jest.Mock).mockRejectedValue(new Error("Database connection failed"));
        await login(mockRequest as Request, mockResponse as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Internal server error" });
    });

    it("returns a recovered account and access token", async () => {
        mockRequest = { body: { email: "test@test.com", password: "password123" } };
        (authServices.recoverAccount as jest.Mock).mockResolvedValue({
            user: { userId: "1", email: "test@test.com" },
            accessToken: "recovered-token",
        });

        await recoverAccount(mockRequest as Request, mockResponse as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
            message: "Account recovered successfully",
            user: { userId: "1", email: "test@test.com" },
            accessToken: "recovered-token",
        });
    });

    it('returns 400 when recover account receives invalid credentials', async () => {
        mockRequest = { body: { email: "test@test.com", password: "wrongpassword" } };
        (authServices.recoverAccount as jest.Mock).mockRejectedValue(new Error("Invalid email or password"));

        await recoverAccount(mockRequest as Request, mockResponse as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid email or password" });
    });

    it('returns 404 when recover account cannot find the app profile', async () => {
        mockRequest = { body: { email: "test@test.com", password: "password123" } };
        (authServices.recoverAccount as jest.Mock).mockRejectedValue(new AccountNotFoundError());

        await recoverAccount(mockRequest as Request, mockResponse as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
            code: "ACCOUNT_NOT_FOUND",
            message: "Account profile was not found.",
        });
    });

    it('returns 409 when recover account is already active', async () => {
        mockRequest = { body: { email: "test@test.com", password: "password123" } };
        (authServices.recoverAccount as jest.Mock).mockRejectedValue(new AccountAlreadyActiveError());

        await recoverAccount(mockRequest as Request, mockResponse as Response);

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
            code: "ACCOUNT_ALREADY_ACTIVE",
            message: "This account is already active. Please log in normally.",
        });
    });

    it('returns 500 when recover account fails unexpectedly', async () => {
        mockRequest = { body: { email: "test@test.com", password: "password123" } };
        (authServices.recoverAccount as jest.Mock).mockRejectedValue(new Error("Database connection failed"));

        await recoverAccount(mockRequest as Request, mockResponse as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Internal server error" });
    });
});
