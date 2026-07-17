import { getViewersService, getManagersService } from "../../../backend/core/src/services/user_auth.services";
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
})