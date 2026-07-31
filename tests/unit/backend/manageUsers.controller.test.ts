import { Request, Response } from "express";
import * as authController from "../../../backend/core/src/controllers/user_auth.controller";
import * as authService from "../../../backend/core/src/services/user_auth.services";
import prisma from "../../../backend/core/src/lib/prisma";

jest.mock("../../../backend/core/src/services/user_auth.services");
jest.mock("../../../backend/core/src/lib/prisma", () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
        },
    },
}));

describe("Controller tests for for getting users and mangers for admin", () => {
    let req: Partial<Request>;
    let resp: Partial<Response>;

    beforeEach(() => {
        jest.resetAllMocks();
        req = {
            body: {},
            params: {}
        };
        resp = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    it("should_return_500_error", async () => {
        (authService.getViewersService as jest.Mock).mockRejectedValue(new Error("No connection"));
        //act
        await authController.getViewersController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(500);
        expect(resp.json).toHaveBeenCalledWith({
            message: "Internal Server Error"
        });
    });

    it("should_return_managers", async () => {
        const mock = [{
            userId: "user123",
            roleType: "BUILDING_MANAGER"
        }];
        (authService.getManagersService as jest.Mock).mockResolvedValue(mock);
        //act
        await authController.getManagersController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(200);
        expect(resp.json).toHaveBeenCalledWith({
            data: mock
        });
    });

    it("should_return_viewers", async () => {
        const mock = [{
            userId: "user123",
            roleType: "VIEWER"
        }];
        (authService.getViewersService as jest.Mock).mockResolvedValue(mock);
        //act
        await authController.getViewersController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(200);
        expect(resp.json).toHaveBeenCalledWith({
            data: mock
        });
    });

    it("should_return_500_error_for_managers", async () => {
        (authService.getManagersService as jest.Mock).mockRejectedValue(new Error("No connection"));
        //act
        await authController.getManagersController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(500);
        expect(resp.json).toHaveBeenCalledWith({
            message: "Internal Server Error"
        });
    });

    it("should_return_200", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({roleType: "BUILDING_MANAGER"});
        //act
        const successResp = {
            success: true,
            message: "Manger assigned to building successfully"
        };
        (authService.assignMangerToBuilding as jest.Mock).mockResolvedValue(successResp);
        await authController.assignManagerController(req as Request, resp as Response);
        //assert
        expect(authService.assignMangerToBuilding).toHaveBeenCalledWith("user-123", "building-123");
        expect(resp.status).toHaveBeenCalledWith(200);
        expect(resp.json).toHaveBeenCalledWith(successResp);
    });

    it("should_throw_400_error_for_missing_stuff", async () => {
         await authController.assignManagerController(req as Request, resp as Response);
        expect(resp.status).toHaveBeenCalledWith(400);
        expect(resp.json).toHaveBeenCalledWith({
            status: "error",
            message: "Both UserId and BuildingId are required"
        }); 
    });

    it("should_throw_404_error_if_user_not_found", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        //act
        await authController.assignManagerController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(404);
        expect(resp.json).toHaveBeenCalledWith({
            message: "User not found"
        });
    });

    it("should_throw_403_error_if_not_manager", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({roleType: "VIEWER"});
        //act
        await authController.assignManagerController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(403);
        expect(resp.json).toHaveBeenCalledWith({
            message: "User has to be a manager"
        });
    });

    it("should_throw_500_error", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error("Unknown error"));
        //act
        await authController.assignManagerController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(500);
        expect(resp.json).toHaveBeenCalledWith({
            message: "Internal Server Error"
        });
    });

    it("should_return_200_when_removing_assignmnet", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({roleType: "BUILDING_MANAGER"});
        //act
        const successResp = {
            success: true,
            message: "Manger removed from building successfully"
        };
        (authService.removeAssignment as jest.Mock).mockResolvedValue(successResp);
        await authController.removeManagerController(req as Request, resp as Response);
        //assert
        expect(authService.removeAssignment).toHaveBeenCalledWith("user-123", "building-123");
        expect(resp.status).toHaveBeenCalledWith(200);
        expect(resp.json).toHaveBeenCalledWith(successResp);
    });

     it("should_throw_400_error_for_missing_stuff_in_remove_assignmnet", async () => {
         await authController.removeManagerController(req as Request, resp as Response);
        expect(resp.status).toHaveBeenCalledWith(400);
        expect(resp.json).toHaveBeenCalledWith({
            status: "error",
            message: "Both UserId and BuildingId are required"
        }); 
    });

    it("should_throw_404_error_if_user_not_found_in_remove_assignment", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
        //act
        await authController.removeManagerController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(404);
        expect(resp.json).toHaveBeenCalledWith({
            message: "User not found"
        });
    });

    it("should_throw_403_error_if_not_manage_in_remove_assignmnetr", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({roleType: "VIEWER"});
        //act
        await authController.removeManagerController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(403);
        expect(resp.json).toHaveBeenCalledWith({
            message: "User has to be a manager"
        });
    });

    it("should_throw_500_error_for_removing_assingmnet_unexpected_error", async () => {
        req.body = {
            userId: "user-123",
            buildingId: "building-123"
        };
        (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error("Unknown error"));
        //act
        await authController.removeManagerController(req as Request, resp as Response);
        //assert
        expect(resp.status).toHaveBeenCalledWith(500);
        expect(resp.json).toHaveBeenCalledWith({
            message: "Internal Server Error"
        });
    });

});
