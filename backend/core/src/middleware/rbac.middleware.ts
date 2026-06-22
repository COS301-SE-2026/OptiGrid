import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { UserRole } from "@prisma/client";

//this function ensures that only the allowed roles have acces to the specific thing needed to be done
export const reqRole = (roleAllowed: UserRole[]) => {
    return (req: Request, resp: Response, nextFunc: NextFunction) => {
        const user = (req as any).user;

        if(!user || !user.roleType) {
            return resp.status(401).json({
                success: false,
                error: "Unauthorised"
            });
        }

        if(user.roleType === UserRole.ADMIN) return nextFunc();

        if(!roleAllowed.includes(user.roleType)) {
            return resp.status(403).json({
                success:false,
                error: "You do not have access to this"
            });
        }
        nextFunc();;
    };
};

export const reqBuildAccess = async (req: Request, resp: Response, nextFunc: NextFunction) => {
    try {
        const user = (req as any).user;
        const {buildingId} = req.params;

        if(!user || !user.userId) {
            return resp.status(401).json({
                success: false,
                error: "Unauthorised"
            });
        }

        if(user.roleType === UserRole.ADMIN) return nextFunc();

        if(!buildingId) {
            return resp.status(400).json({
                success: false,
                error: "Building Id required"
            });
        }
        //this logic ensures the user can only access buildings it has access to by using the userBuildingAccess
        //table defined in prisma
        const haveAccess = await prisma.userBuildingAccess.findUnique({
            where: {
                user_id_building_id: {
                    user_id: user.userId,
                    building_id: buildingId
                },
            },
        });

        if(!haveAccess) {
            return resp.status(403).json({
                success: false,
                error: "You do not have access to this building"
            });
        }
        nextFunc();
    }
    catch (error){
        resp.status(500).json({
            success: false,
            error: "Internal Server Error"
        });
    }
};