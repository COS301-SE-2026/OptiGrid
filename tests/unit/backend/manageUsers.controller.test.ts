import { Request, Response } from "express";
import * as authController from "../../../backend/core/src/controllers/user_auth.controller";
import * as authService from "../../../backend/core/src/services/user_auth.services";

jest.mock("../../../backend/core/src/services/user_auth.services");

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

});
