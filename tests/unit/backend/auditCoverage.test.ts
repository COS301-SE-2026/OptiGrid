jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({})),
    UserRole: { ADMIN: 'ADMIN', BUILDING_MANAGER: 'BUILDING_MANAGER', VIEWER: 'VIEWER' },
}));

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: { findUnique: jest.fn() },
    },
}));

jest.mock('../../../backend/core/src/services/user_auth.services');

jest.mock('../../../backend/core/src/services/auditLog.service', () => ({
    __esModule: true,
    recordAuditLog: jest.fn().mockResolvedValue(true),
    getClientIp: jest.fn().mockReturnValue('203.0.113.7'),
}));

import { Request, Response } from 'express';
import { login, logout, signup, assignManagerController, removeManagerController } from '../../../backend/core/src/controllers/user_auth.controller';
import * as authServices from '../../../backend/core/src/services/user_auth.services';
import { recordAuditLog } from '../../../backend/core/src/services/auditLog.service';
import prisma from '../../../backend/core/src/lib/prisma';

const mockedRecord = recordAuditLog as jest.Mock;
const mockedAuth = authServices as jest.Mocked<typeof authServices>;
const mockedPrisma = prisma as unknown as { user: { findUnique: jest.Mock } };

function buildResponse() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { response: { status } as unknown as Response, status, json };
}

describe('audit coverage for account activity', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedRecord.mockResolvedValue(true);
    });

    it('records a signup so account creation is traceable', async () => {
        mockedAuth.signup.mockResolvedValue({
            userId: 'user-1',
            email: 'new@optigrid.test',
        } as never);

        const request = {
            body: { email: 'new@optigrid.test', password: 'Secret123!', name: 'New User' },
        } as Request;
        const { response } = buildResponse();

        await signup(request, response);

        expect(mockedRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                actionType: 'SIGNUP',
                targetTable: 'users',
            }),
        );
    });

    it('records a rejected login attempt', async () => {
        mockedAuth.login.mockRejectedValue(new Error('Invalid email or password'));

        const request = {
            body: { email: 'attacker@optigrid.test', password: 'wrong' },
        } as Request;
        const { response, status } = buildResponse();

        await login(request, response);

        expect(status).toHaveBeenCalledWith(400);
        expect(mockedRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                actionType: 'LOGIN_FAILED',
                targetTable: 'users',
                newValue: { email: 'attacker@optigrid.test' },
            }),
        );
    });

    it('doesnt record a failed attempt when the login succeeds', async () => {
        mockedAuth.login.mockResolvedValue({
            user: { userId: 'user-1' },
            accessToken: 'token',
        } as never);

        const request = {
            body: { email: 'user@optigrid.test', password: 'Secret123!' },
        } as Request;
        const { response } = buildResponse();

        await login(request, response);

        const actions = mockedRecord.mock.calls.map((call) => call[0].actionType);
        expect(actions).toContain('LOGIN');
        expect(actions).not.toContain('LOGIN_FAILED');
    });

    it('records a logout so both ends of a session appear in the trail', async () => {
        const request = { user: { id: 'user-1' } } as unknown as Request;
        const { response, status } = buildResponse();

        await logout(request, response);

        expect(status).toHaveBeenCalledWith(200);
        expect(mockedRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'user-1',
                actionType: 'LOGOUT',
                targetTable: 'users'
            }),
        );
    });

    it('rejects a logout that carries no session', async () => {
        const request = {} as Request;
        const { response, status } = buildResponse();

        await logout(request, response);

        expect(status).toHaveBeenCalledWith(401);
        expect(mockedRecord).not.toHaveBeenCalled();
    });

    it('reports a failure when the logout cannot be recorded', async () => {
        mockedRecord.mockResolvedValue(false);
        const request = { user: { id: 'user-1' } } as unknown as Request;
        const { response, status } = buildResponse();

        await logout(request, response);

        expect(status).toHaveBeenCalledWith(503);
    });

    it('records which building a manager was assigned to', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue({ roleType: 'BUILDING_MANAGER' });
        mockedAuth.assignMangerToBuilding.mockResolvedValue({ success: true } as never);

        const request = {
            body: { userId: 'manager-1', buildingId: 'building-1' },
            user: { id: 'admin-1' },
        } as unknown as Request;
        const { response } = buildResponse();

        await assignManagerController(request, response);

        expect(mockedRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'admin-1',
                buildingId: 'building-1',
                actionType: 'ASSIGN_MANAGER',
                targetTable: 'building_authorized_users',
            }),
        );
    });

        it('does not record an assignment that was rejected', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue({ roleType: 'VIEWER' });

        const request = {
            body: { userId: 'viewer-1', buildingId: 'building-1' },
            user: { id: 'admin-1' },
        } as unknown as Request;
        const { response, status } = buildResponse();

        await assignManagerController(request, response);

        expect(status).toHaveBeenCalledWith(403);
        expect(mockedRecord).not.toHaveBeenCalled();
    });

    it('records which building a manager was removed from', async () => {
        mockedPrisma.user.findUnique.mockResolvedValue({ roleType: 'BUILDING_MANAGER' });
        mockedAuth.removeAssignment.mockResolvedValue({ success: true } as never);

        const request = {
            body: { userId: 'manager-1', buildingId: 'building-1' },
            user: { id: 'admin-1' },
        } as unknown as Request;
        const { response } = buildResponse();

        await removeManagerController(request, response);

        expect(mockedRecord).toHaveBeenCalledWith(
            expect.objectContaining({
                actionType: 'REMOVE_MANAGER',
                targetTable: 'building_authorized_users',
            }),
        );
    });
});