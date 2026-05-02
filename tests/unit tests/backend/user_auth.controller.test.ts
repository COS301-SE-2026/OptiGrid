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

import { login } from '../../../backend/core/src/controllers/user_auth.controller';
import * as authServices from '../../../backend/core/src/services/user_auth.services';
import { Request, Response } from 'express';

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
        mockRequest = { body: { email: "test@test.com", password: "password123" } };
        //mocking the service to return a successful user
        (authServices.login as jest.Mock).mockResolvedValue(mockSafeUser);
        await login(mockRequest as Request, mockResponse as Response);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({ message: "Login successful", user: mockSafeUser });
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
});
