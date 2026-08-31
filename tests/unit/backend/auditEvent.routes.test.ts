import express from 'express';
import request from 'supertest';
import prisma from '../../../backend/core/src/lib/prisma';
import auditEventRoutes from '../../../backend/core/src/routes/auditEvent.routes';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        auditLog: {
            create: jest.fn(),
        },
    },
}));

function createAuditEventApp(authenticated = true) {
    const app = express();
    app.use(express.json());
    if (authenticated) {
        app.use((req, _resp, next) => {
            (req as any).user = { id: "user-1", roleType: "VIEWER" };
            next();
        });
    }
    app.use('/api/audit-events', auditEventRoutes);
    return app;
}

describe("Audit Event Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.auditLog.create as jest.Mock).mockResolvedValue({ log_id: "log-1" });
    });

    it("records a supported page view using the authenticated user", async () => {
        const response = await request(createAuditEventApp())
            .post('/api/audit-events/page-view')
            .send({ page: "DASHBOARD", user_id: "spoofed-user" });

        expect(response.status).toBe(201);
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                user_id: "user-1",
                action_type: "VIEW_DASHBOARD",
                target_table: "pages",
                new_value: { page: "DASHBOARD" },
            }),
        });
    });

    it("rejects an unsupported page", async () => {
        const response = await request(createAuditEventApp())
            .post('/api/audit-events/page-view')
            .send({ page: "ADMIN" });

        expect(response.status).toBe(400);
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("rejects a request without an authenticated user", async () => {
        const response = await request(createAuditEventApp(false))
            .post('/api/audit-events/page-view')
            .send({ page: "LIVE" });

        expect(response.status).toBe(401);
        expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
});
