import { getViewersService, getManagersService, assignMangerToBuilding } from "../../../backend/core/src/services/user_auth.services";
import prisma from "../../../backend/core/src/lib/prisma";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {
        user: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        userBuildingAccess: {
            create: jest.fn(),
        }
    },
}));

describe("ALl user operations for admin such as getting viewers, managers etc.", () => {
    afterEach(() => {jest.clearAllMocks()});

    it("should_return_all_buildings_for_a_viewer", async ()=> {
        const mock = [{
            userId: "testUser",
            firstName: "Tester",
            roleType: "VIEWER",
            buildingAccess: [{
                building_id: "building-123"
            }]
        }];
        (prisma.user.findMany as jest.Mock).mockResolvedValue(mock);
        //act
        const out = await getViewersService();
        //assert
        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: {
                roleType: "VIEWER"
            },
            select: expect.any(Object)
        });
        expect(out[0].buildingIds).toEqual(["building-123"]);
    });

    it("should_return_all_buildings_for_a_manager", async ()=> {
        const mock = [{
            userId: "testUser",
            firstName: "Tester",
            roleType: "BUILDING_MANAGER",
            buildingAccess: [{
                building_id: "building-123"
            }]
        }];
        (prisma.user.findMany as jest.Mock).mockResolvedValue(mock);
        //act
        const out = await getManagersService();
        //assert
        expect(prisma.user.findMany).toHaveBeenCalledWith({
            where: {
                roleType: "BUILDING_MANAGER"
            },
            select: expect.any(Object)
        });
        expect(out[0].buildingIds).toEqual(["building-123"]);
    });

    it("should_assign_a_building_to_managr", async () => {
        const mock = {
            userId: "user-123",
            roleType: "BUILDING_MANAGER"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mock);
        (prisma.userBuildingAccess.create as jest.Mock).mockResolvedValue({});
        //act
        const out = await assignMangerToBuilding("user-123", "building-123");
        //asset
        expect(prisma.userBuildingAccess.create).toHaveBeenCalledWith({
            data: {
                user_id: "user-123",
                building_id: "building-123"
            }
        });
        expect(out.success).toBe(true);
        expect(out.message).toBe("Manger assigned to building successfully");
    });

    it("should_throw_error_if_not_user", async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        //act 
        //assert
        await expect(assignMangerToBuilding("user-123", "building-124")).rejects.toThrow("User not found");
    });

    it("should_throw_p2002_error_for_already_assigned_buildings", async () => {
        const mock = {
            userId: "user-123",
            roleType: "BUILDING_MANAGER"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mock);
        //act
        const prismaerr: any = new Error("Unique Failed");
        prismaerr.code = "P2002";
        (prisma.userBuildingAccess.create as jest.Mock).mockRejectedValue(prismaerr);
        const  out = await assignMangerToBuilding("user-123", "building-124");
        //arrange
        expect(out.success).toBe(true);
        expect(out.message).toBe("Building was already assigned to another manager");
    });
});