import { getUserTheme, updateUserTheme } from "../../../backend/core/src/controllers/user_preferences.controller";
import prisma from "../../../backend/core/src/lib/prisma";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    user: {
        findUnique: jest.fn(),
        update: jest.fn(),
    },
}));

describe("User Preferences Controller", () => {
    const mockReq = { user: { id: "user-123" }, body: {} } as any;
    const mockRes = { json: jest.fn(), status: jest.fn().mockReturnThis() } as any;

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
});