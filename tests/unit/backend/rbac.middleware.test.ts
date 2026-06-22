import {reqRole, reqBuildAccess} from "../../../backend/core/src/middleware/rbac.middleware";
import prisma from "../../../backend/core/src/lib/prisma";
import {Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";

jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {
        userBuildingAccess: {
            findUnique: jest.fn(),
        },
    }
}));

describe("Role Based Access Control (RBAC) Unit Tests", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;
    let nextFunc: NextFunction;
    let statusMock: jest.Mock;
    let json: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        json= jest.fn();
        statusMock = jest.fn().mockReturnValue({
            json: json
        });

        resp = {status: statusMock};
        nextFunc = jest.fn();
    });

    it("should_call_next()_for_admin_reqRole_fucntion", () => {
        //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.ADMIN
            } 
        } as any;
        //act
        const middleware = reqRole([UserRole.BUILDING_MANAGER]);
        middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(statusMock).not.toHaveBeenCalled();
    });

    it("should_call_next_if_manager_or_viewer_has_role_reqRole_func", () => {
        //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.BUILDING_MANAGER
            } 
        } as any;
        //act
        const middleware = reqRole([UserRole.BUILDING_MANAGER]);
        middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(statusMock).not.toHaveBeenCalled();

    });

    it("should_return_403_error_if_role_not_allowed_rqRole_func", () => {
        //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.VIEWER
            } 
        } as any;
        //act
        const middleware = reqRole([UserRole.BUILDING_MANAGER]);
        middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(statusMock).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({
            success: false,
            error: "You do not have access to this"
        });
        expect(nextFunc).not.toHaveBeenCalled();
    });

    it("shoudl_return_401_error_if _we_dont_have_a_user_reqRole_func", () => {
        //arrange 
        req = {};
         //act
        const middleware = reqRole([UserRole.BUILDING_MANAGER]);
        middleware(req as Request, resp as Response, nextFunc);
        //assert
        expect(statusMock).toHaveBeenCalledWith(401);
        expect(json).toHaveBeenCalledWith({
            success: false,
            error: "Unauthorised"
        });
        expect(nextFunc).not.toHaveBeenCalled();
    });

    it("should_call_next()_for_admin_access_fucntion", async () => {
         //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.ADMIN
            } ,
            params: {
                buildingId: "building-123"
            }
        } as any;
        //act
        await reqBuildAccess(req as Request, resp as Response, nextFunc);
        //arrange
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(prisma.userBuildingAccess.findUnique).not.toHaveBeenCalled();
    });

    it("should_call_next_if_record_found_reqRole_func", async () => {
        //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.VIEWER
            } ,
            params: {
                buildingId: "building-123"
            }
        } as any;
        //act
        (prisma.userBuildingAccess.findUnique as jest.Mock).mockResolvedValue({
            user_id: "user-123",
            building_id: "building-123"
        });
        await reqBuildAccess(req as Request, resp as Response, nextFunc);
        //arrange
        expect(prisma.userBuildingAccess.findUnique).toHaveBeenCalledWith({
            where: { user_id_building_id: {
                user_id: "user-123",
                building_id: "building-123"
            }}
        });
        expect(nextFunc).toHaveBeenCalledTimes(1);
        expect(statusMock).not.toHaveBeenCalled();
    });

    it("should_return_403_error_if_building_ud_missing_access_func", async () => {
        //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.VIEWER
            } ,
            params: {}
        } as any;
        //act
        await reqBuildAccess(req as Request, resp as Response, nextFunc);
        //assert
        expect(json).toHaveBeenCalledWith({
            success: false,
            error: "Building Id required"
        });
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(nextFunc).not.toHaveBeenCalled();
    });

    it("should_return_500_for_unexect_error", async () => {
        //arrange
        req = {
            user: {
                userId: "user-123",
                roleType: UserRole.VIEWER
            } ,
            params: {
                buildingId: "building-123"
            }
        } as any;
        //act
        (prisma.userBuildingAccess.findUnique as jest.Mock).mockRejectedValue(
            (new Error("Unexpected Error"))
        );
        await reqBuildAccess(req as Request, resp as Response, nextFunc);
        //assert
        expect(json).toHaveBeenCalledWith({
            success: false,
            error: "Internal Server Error"
        });
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(nextFunc).not.toHaveBeenCalled();
    });
});