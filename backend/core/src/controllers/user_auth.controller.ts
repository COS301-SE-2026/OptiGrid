import { Request, Response } from 'express';
import * as authService from '../services/user_auth.services';
import prisma from '../lib/prisma';

export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, name, roleType} = req.body;
        const user = await authService.signup(email, password, name, roleType);
            
        return res.status(201).json({
            message: 'User created successfully',
            user,
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            // if user exist, we return 400, else it's internal error
            if (error.message === 'User already exists, please login instead.') {
                return res.status(400).json({ 
                    message: error.message 
                });
            }
            console.error('Signup error:', error.message);
        } 
        else {
            console.error('Signup error (non-error):', error);
        }
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
};

//this function is used for the login logic
export const login = async (req: Request, res: Response) => {
    try{
        const {email, password} = req.body;
        if(!email || !password){
            return res.status(400).json({message: "Email and password are required fields."});
        }
        const loginResult = await authService.login(email, password);
        return res.status(200).json({
            message: 'Login successful',
            user: loginResult.user,
            accessToken: loginResult.accessToken,
        });
    }
    catch(error: unknown){
        if(error instanceof Error){
            if (error.message === 'Invalid email or password') {
                return res.status(400).json({ message: "Invalid email or password" });
            }
            console.error("Login error:", error);
        }
        else {
            console.error("Login error:", error);
        }
        return res.status(500).json({message: "Internal server error"});
    }
}

export const getViewersController = async (req:Request, resp:Response) => {
    try {
        const viewers = await authService.getViewersService();
        return resp.status(200).json({
            data: viewers
        });
    }
    catch(error) {
        console.error("Internal Server Error when fetching viewers: ", error);
        return resp.status(500).json({
            message: "Internal Server Error"
        });
    }
};

export const getManagersController = async (req:Request, resp:Response) => {
    try {
        const managers = await authService.getManagersService();
        return resp.status(200).json({
            data: managers
        });
    }
    catch(error) {
        console.error("Internal Server Error when fetching managers: ", error);
        return resp.status(500).json({
            message: "Internal Server Error"
        });
    }
};

export const assignManagerController = async (req:Request, resp:Response) => {
    try {
        const {userId, buildingId} =req.body;
        if(!userId || !buildingId) {
            return resp.status(400).json({
                status: "error",
                message: "Both UserId and BuildingId are required"
            });
        }

        const user = await prisma.user.findUnique({
            where: {userId},
            select: {
                roleType: true
            }
        });
        if(!user) {
            return resp.status(404).json({
                message: "User not found"
            });
        }
        if(user.roleType !== "BUILDING_MANAGER") {
            return resp.status(403).json({
                message: "User has to be a manager"
            });
        }

        const out = await authService.assignMangerToBuilding(userId, buildingId);
        return resp.status(200).json(out);
    }
    catch(error: unknown) {
        console.error("Error when assigning: ", error);
        return resp.status(500).json({
            message: "Internal Server Error"
        });
    }
};

export const removeManagerController = async (req:Request, resp:Response) => {
    try {
        const {userId, buildingId} =req.body;
        if(!userId || !buildingId) {
            return resp.status(400).json({
                status: "error",
                message: "Both UserId and BuildingId are required"
            });
        }

        const user = await prisma.user.findUnique({
            where: {userId},
            select: {
                roleType: true
            }
        });
        if(!user) {
            return resp.status(404).json({
                message: "User not found"
            });
        }
        if(user.roleType !== "BUILDING_MANAGER") {
            return resp.status(403).json({
                message: "User has to be a manager"
            });
        }

        const out = await authService.removeAssignment(userId, buildingId);
        return resp.status(200).json(out);
    }
    catch(error: unknown) {
        console.error("Error when removing assignment: ", error);
        return resp.status(500).json({
            message: "Internal Server Error"
        });
    }
};