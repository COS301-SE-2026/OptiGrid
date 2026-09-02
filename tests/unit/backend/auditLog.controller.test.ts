import { Request, Response } from 'express';
import { listAuditLogs, recordAuditLog } from '../../../backend/core/src/services/auditLog.service';
import { listAuditLogsController, recordAuditPageViewController } from '../../../backend/core/src/controllers/auditLog.controller';

jest.mock('../../../backend/core/src/services/auditLog.service', () => ({
    listAuditLogs: jest.fn(),
    recordAuditLog: jest.fn(),
    getClientIp: jest.fn().mockReturnValue("196.25.1.4"),
}));

describe("Audit Log Controller", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;
    beforeEach(() => {
        jest.clearAllMocks();
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        resp = { status: statusMock, json: jsonMock } as Partial<Response>;
        req = {
            user: { id: "admin-1", roleType: "ADMIN" },
            query: {},
        } as unknown as Partial<Request>;
        (listAuditLogs as jest.Mock).mockResolvedValue({ items: [], nextCursor: null });
        (recordAuditLog as jest.Mock).mockResolvedValue(true);
    });

    it("returns 401 when unauthenticated user submits a request", async () => {
        req.user = undefined;
        await listAuditLogsController(req as Request, resp as Response);
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(listAuditLogs).not.toHaveBeenCalled();
    });

    it("returns the entries on success", async () => {
        (listAuditLogs as jest.Mock).mockResolvedValue({
            items: [{ log_id: "log-1" }],
            nextCursor: "7f263a8e-977c-44c4-b06d-52805c9b5fc7"
        });

        await listAuditLogsController(req as Request, resp as Response);
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
            status: "success",
            data: [{ log_id: "log-1" }],
            next_cursor: "7f263a8e-977c-44c4-b06d-52805c9b5fc7"
        });
    });

    it("passes the filters through", async () => {
        req.query = {
            action_type: "LOGIN",
            severity: "error",
            user_id: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2",
            limit: "25"
        };

        await listAuditLogsController(req as Request, resp as Response);
        expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
            action_type: "LOGIN",
            severity: "error",
            user_id: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2",
            limit: 25
        }));
    });

    it("passes page and cursor filters through", async () => {
        req.query = {
            page: "COMPARE",
            cursor: "7f263a8e-977c-44c4-b06d-52805c9b5fc7"
        };

        await listAuditLogsController(req as Request, resp as Response);

        expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
            page: "COMPARE",
            cursor: "7f263a8e-977c-44c4-b06d-52805c9b5fc7"
        }));
    });

    it("rejects action and page filters used together", async () => {
        req.query = { action_type: "LOGIN", page: "DASHBOARD" };

        await listAuditLogsController(req as Request, resp as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(listAuditLogs).not.toHaveBeenCalled();
    });

    it("passes the building manager scope to the service", async () => {
        req.user = { id: "manager-1", roleType: "BUILDING_MANAGER" };

        await listAuditLogsController(req as Request, resp as Response);

        expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
            manager_id: "manager-1"
        }));
    });

    it("keeps a manager user filter inside the manager scope", async () => {
        req.user = { id: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2", roleType: "BUILDING_MANAGER" };
        req.query = { user_id: "72339cd8-7168-4ba9-a56b-2b00e84b3436" };

        await listAuditLogsController(req as Request, resp as Response);

        expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
            manager_id: "8f66ec53-28f4-4f1d-8f6f-d3f38c17e9a2",
            user_id: "72339cd8-7168-4ba9-a56b-2b00e84b3436"
        }));
    });


    it("returns 400 for a bad user id filter", async () => {
        req.query = { user_id: "not-a-uuid" };
        await listAuditLogsController(req as Request, resp as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(listAuditLogs).not.toHaveBeenCalled();
    });

    it("defaults the limit to fifty", async () => {
        await listAuditLogsController(req as Request, resp as Response);
        expect(listAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
    });


    it("returns 400 when the limit is above the cap", async () => {
        req.query = { limit: "500" };

        await listAuditLogsController(req as Request, resp as Response);
        expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("returns 500 when the service fails", async () => {
        (listAuditLogs as jest.Mock).mockRejectedValue(new Error("db down"));
        jest.spyOn(console, "error").mockImplementation(() => { });
        await listAuditLogsController(req as Request, resp as Response);
        expect(statusMock).toHaveBeenCalledWith(500);
    });

    it("records a validated page view for the authenticated user", async () => {
        req.body = { page: "LIVE" };

        await recordAuditPageViewController(req as Request, resp as Response);

        expect(recordAuditLog).toHaveBeenCalledWith({
            userId: "admin-1",
            actionType: "VIEW_LIVE",
            targetTable: "pages",
            newValue: { page: "LIVE" },
            ipAddress: "196.25.1.4",
        });
        expect(statusMock).toHaveBeenCalledWith(201);
    });

    it("rejects an unsupported page view", async () => {
        req.body = { page: "ADMIN" };

        await recordAuditPageViewController(req as Request, resp as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(recordAuditLog).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated page view", async () => {
        req.user = undefined;
        req.body = { page: "DASHBOARD" };

        await recordAuditPageViewController(req as Request, resp as Response);

        expect(statusMock).toHaveBeenCalledWith(401);
        expect(recordAuditLog).not.toHaveBeenCalled();
    });

    it("reports when page activity cannot be stored", async () => {
        req.body = { page: "COMPARE" };
        (recordAuditLog as jest.Mock).mockResolvedValue(false);

        await recordAuditPageViewController(req as Request, resp as Response);

        expect(statusMock).toHaveBeenCalledWith(503);
    });
});
