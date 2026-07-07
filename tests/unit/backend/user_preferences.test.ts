import { getUserTheme, updateUserTheme } from "../../../backend/core/src/controllers/user_preferences.controller";
import prisma from "../../../backend/core/src/lib/prisma";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
}));

describe("User Preferences Controller", () => {
    let mockReq: any;
    let mockRes: any;
    beforeEach(() => {
        jest.clearAllMocks();
        mockReq = { user: { id: "user-123" }, body: {} };
        mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    });

    it("should fetch theme correctly", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ preferredTheme: "DARK" });
        await getUserTheme(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith({ theme: "dark" });
    });

    it("should update theme correctly", async () => {
        mockReq.body = { theme: "light" };
        (prisma.user.update as jest.Mock).mockResolvedValue({});
        await updateUserTheme(mockReq, mockRes);
        expect(prisma.user.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { preferredTheme: "LIGHT" } })
        );
    });

    it("should reject an invalid theme value with a 400 code", async () => {
        mockReq.body = { theme: "red" };
        await updateUserTheme(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: "error", message: "Invalid theme payload" }));
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("should reject a missing theme field with a 400 instead of just crashing", async () => {
        mockReq.body = {};
        await updateUserTheme(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("should reject payloads with any unexpected extra fields", async () => {
        mockReq.body = { theme: "dark", role: "admin" };
        await updateUserTheme(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});
