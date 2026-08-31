import prisma from '../../../backend/core/src/lib/prisma';
import express from 'express';
import request from 'supertest';
import auditLogRoutes from '../../../backend/core/src/routes/auditLog.routes';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        auditLog: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    },
}));

let currentRole = "ADMIN";

jest.mock('../../../backend/core/src/middleware/rbac.middleware', () => ({
    reqRole: (allowed: string[]) => (req: any, resp: any, next: any) => {
        if (currentRole !== "ADMIN" && !allowed.includes(currentRole)) {
            return resp.status(403).json({ success: false, error: "You do not have access to this" });
        }
        next();
    },
}));

const mockedLog = {
    log_id: "log-1",
    user_id: "user-1",
    building_id: null,
    action_type: "LOGIN",
    target_table: "users",
    ip_address: "196.25.1.4",
    timestamp: new Date("2026-08-24T09:15:00Z"),
    user: { email: "amina@optigrid.test" },
};

function createAuditApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _resp, next) => {
        (req as any).user = { id: "admin-1", roleType: currentRole };
        next();
    });
    app.use('/api/admin/audit-logs', auditLogRoutes);
    return app;
}

describe("Audit Log Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        currentRole = "ADMIN";
        (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockedLog]);
    });

    it("rejects a viewer", async () => {
        currentRole = "VIEWER";

        const response = await request(createAuditApp()).get('/api/admin/audit-logs');
        expect(response.status).toBe(403);
        expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });

    it("allows a building manager to view their own audit logs", async () => {
        currentRole = "BUILDING_MANAGER";

        const response = await request(createAuditApp()).get('/api/admin/audit-logs');

        expect(response.status).toBe(200);
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
        expect(args.where.OR).toEqual(expect.arrayContaining([
            expect.objectContaining({ user_id: "admin-1" })
        ]));
    });

    it("returns the logs in the shape which the view expects", async () => {
        const response = await request(createAuditApp()).get('/api/admin/audit-logs');
        expect(response.status).toBe(200);
        expect(response.body.status).toBe("success");
        expect(response.body.next_cursor).toBeNull();
        expect(response.body.data[0]).toEqual({
            log_id: "log-1",
            timestamp: "2026-08-24T09:15:00.000Z",
            action_type: "LOGIN",
            target_table: "users",
            service: null,
            operation: null,
            severity: null,
            user_id: "user-1",
            building_id: null,
            user_email: "amina@optigrid.test",
            ip_address: "196.25.1.4"
        });
    });

    it("applies the filters that the proxy forwards", async () => {
        const response = await request(createAuditApp())
            .get('/api/admin/audit-logs')
            .query({
                user_id: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2",
                from: "2026-08-01",
                to: "2026-08-24",
                page: "DASHBOARD",
                cursor: "7f263a8e-977c-44c4-b06d-52805c9b5fc7",
                limit: "25",
            });

        expect(response.status).toBe(200);
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
        expect(args.where.action_type).toBe("VIEW_DASHBOARD");
        expect(args.where.user_id).toBe("8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2");
        expect(args.cursor).toEqual({ log_id: "7f263a8e-977c-44c4-b06d-52805c9b5fc7" });
        expect(args.skip).toBe(1);
        expect(args.take).toBe(26);
    });

    it("rejects an invalid filter", async () => {
        const response = await request(createAuditApp()).get('/api/admin/audit-logs').query({ user_id: "not-a-uuid" });
        expect(response.status).toBe(400);
        expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    });
});


