import { listAuditLogs, recordAuditLog, getClientIp } from '../../../backend/core/src/services/auditLog.service';
import prisma from '../../../backend/core/src/lib/prisma';
import type { Request } from 'express';

jest.mock('../../../backend/core/src/lib/prisma', () => ({
    __esModule: true,
    default: {
        auditLog: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    },
}));

const mockedLog = {
    log_id: "log-1",
    user_id: "user-1",
    building_id: "building-1",
    action_type: "LOGIN",
    target_table: "users",
    ip_address: "196.25.1.4",
    timestamp: new Date("2026-08-24T09:15:00Z"),
    user: { email: "amina@optigrid.test" }
};

describe("Audit Log Service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([mockedLog]);
    });

    it("returns the newest entries first", async () => {
        await listAuditLogs({ limit: 50 });
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];

        expect(args.orderBy).toEqual({ timestamp: "desc" });
        expect(args.take).toBe(50);
    });

    it("maps the user email directly to the entry", async () => {
        const logs = await listAuditLogs({ limit: 50 });
        expect(logs[0].user_email).toBe("amina@optigrid.test");
        expect(logs[0].log_id).toBe("log-1");
    });

    it("doesn't filter when no filters are given", async () => {
        await listAuditLogs({ limit: 50 });
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
        expect(args.where).toEqual({});
    });

    it("filters by action and by user", async () => {
        await listAuditLogs({ action_type: "LOGIN", user_id: "user-1", limit: 10 });
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];

        expect(args.where.action_type).toBe("LOGIN");
        expect(args.where.user_id).toBe("user-1");
    });

    it("scopes a manager to themselves and actions for an authorized building", async () => {
        await listAuditLogs({ manager_id: "manager-1", limit: 50 });
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];

        expect(args.where.OR).toEqual([
            { user_id: "manager-1" },
            {
                building: {
                    is: {
                        authorized_users: {
                            some: { user_id: "manager-1" }
                        }
                    }
                }
            }
        ]);
    });

    it("cover the whole of the last day in a range", async () => {
        await listAuditLogs({
            from: new Date("2026-08-01T00:00:00Z"),
            to: new Date("2026-08-24T00:00:00Z"),
            limit: 50
        });
        const args = (prisma.auditLog.findMany as jest.Mock).mock.calls[0][0];
        expect(args.where.timestamp.gte).toEqual(new Date("2026-08-01T00:00:00Z"));
        expect(args.where.timestamp.lte).toEqual(new Date("2026-08-24T23:59:59.999Z"));
    });

    it("writes an audit entry", async () => {
        await recordAuditLog({
            userId: "user-1",
            buildingId: "building-1",
            actionType: "UPDATE",
            targetTable: "buildings",
            newValue: { building_name: "Sandton HQ" },
            ipAddress: "196.25.1.4"
        });

        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: {
                user_id: "user-1",
                building_id: "building-1",
                action_type: "UPDATE",
                target_table: "buildings",
                old_value: undefined,
                new_value: { building_name: "Sandton HQ" },
                ip_address: "196.25.1.4"
            },
        });
    });
    it("handles a write failure so the request still succeeds", async () => {
        (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error("db down"));
        jest.spyOn(console, "error").mockImplementation(() => {});

        await expect(recordAuditLog({ actionType: "LOGIN", targetTable: "users" })).resolves.toBeUndefined();
    });

    it("takes the first address from a forwarded chain", () => {
        const req = { headers: { "x-forwarded-for": "196.25.1.4, 10.0.0.1" } } as unknown as Request;
        expect(getClientIp(req)).toBe("196.25.1.4");
    });

    it("returns null when the request carries no address", () => {
        expect(getClientIp({} as Request)).toBeNull();
    });

    it("falls back to the socket address", () => {
        const req = { headers: {}, ip: "10.0.0.9" } as unknown as Request;
        expect(getClientIp(req)).toBe("10.0.0.9");
    });
});
