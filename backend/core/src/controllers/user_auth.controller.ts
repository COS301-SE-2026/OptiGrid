import { Request, Response } from 'express';
import {
    AccountAlreadyActiveError,
    AccountDeactivatedError,
    AccountNotFoundError,
} from '../errors/account.errors';
import prisma from '../lib/prisma';
import * as authService from '../services/user_auth.services';
import { getClientIp, recordAuditLog } from '../services/auditLog.service';

export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        const user = await authService.signup(email, password, name);

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
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required fields." });
        }
        const loginResult = await authService.login(email, password);

        await recordAuditLog({
            userId: loginResult.user.userId,
            actionType: "LOGIN",
            targetTable: "users",
            ipAddress: getClientIp(req)
        });

        return res.status(200).json({
            message: 'Login successful',
            user: loginResult.user,
            accessToken: loginResult.accessToken,
        });
    }
    catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'Invalid email or password') {
                return res.status(400).json({ message: "Invalid email or password" });
            }
            if (error instanceof AccountDeactivatedError) {
                return res.status(403).json({
                    code: error.code,
                    message: error.message,
                });
            }
            console.error("Login error:", error);
        }
        else {
            console.error("Login error:", error);
        }
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const googleAuthLoginController = async (req: Request, resp: Response) => {
    try {
        const { access, email, firstName, lastName } = req.body;
        if(!access) {
            return resp.status(400).json({ 
                message: "Access token required" 
            });
        }

        const out = await authService.googleAuthLogin(access, email, firstName, lastName);
        await recordAuditLog({
            userId: out.user.userId,
            actionType: "LOGIN",
            targetTable: "users",
            ipAddress: getClientIp(req)
        });

        return resp.status(200).json({
            message: 'OAuth Login successful',
            user: out.user,
            accessToken: out.accessToken,
        });
    } 
    catch(error: unknown) {
        if(error instanceof AccountDeactivatedError) {
            return resp.status(403).json({ 
                code: error.code, 
                message: error.message 
            });
        }
        if(error instanceof Error) console.error("OAuth Login error:", error.message);
        return resp.status(401).json({ 
            message: "Unauthorized or invalid access token" 
        });
    }
};

// A deactivated user must be able to prove their identity and restore the
// account without first passing the active-account middleware.
export const recoverAccount = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const recoveryResult = await authService.recoverAccount(email, password);

        return res.status(200).json({
            message: 'Account recovered successfully',
            ...recoveryResult,
        });
    } catch (error: unknown) {
        if (error instanceof AccountAlreadyActiveError) {
            return res.status(409).json({ code: error.code, message: error.message });
        }
        if (error instanceof AccountNotFoundError) {
            return res.status(404).json({ code: error.code, message: error.message });
        }
        if (error instanceof Error && error.message === 'Invalid email or password') {
            return res.status(400).json({ message: error.message });
        }

        if (error instanceof Error) {
            console.error('Account recovery error:', error.message);
        } else {
            console.error('Account recovery error:', error);
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};
export const getViewersController = async (req: Request, resp: Response) => {
    try {
        const viewers = await authService.getViewersService();
        return resp.status(200).json({
            data: viewers
        });
    }
    catch (error) {
        console.error("Internal Server Error when fetching viewers: ", error);
        return resp.status(500).json({
            message: "Internal Server Error"
        });
    }
};

export const getManagersController = async (req: Request, resp: Response) => {
    try {
        const managers = await authService.getManagersService();
        return resp.status(200).json({
            data: managers
        });
    }
    catch (error) {
        console.error("Internal Server Error when fetching managers: ", error);
        return resp.status(500).json({
            message: "Internal Server Error"
        });
    }
};

const helperForManager = (
    funcToCall: (userId: string, buildingId: string) => Promise<any>,
    action: string
) => {
    return async (req: Request, resp: Response) => {
        try {
            const { userId, buildingId } = req.body;
            if (!userId || !buildingId) {
                return resp.status(400).json({
                    status: "error",
                    message: "Both UserId and BuildingId are required"
                });
            }

            const user = await prisma.user.findUnique({
                where: { userId },
                select: {
                    roleType: true
                }
            });
            if (!user) {
                return resp.status(404).json({
                    message: "User not found"
                });
            }
            if (user.roleType !== "BUILDING_MANAGER") {
                return resp.status(403).json({
                    message: "User has to be a manager"
                });
            }

            const out = await funcToCall(userId, buildingId);
            return resp.status(200).json(out);
        }
        catch (error: unknown) {
            console.error(`Error when ${action}: `, error);
            return resp.status(500).json({
                message: "Internal Server Error"
            });
        }
    };
};
export const assignManagerController = helperForManager(authService.assignMangerToBuilding, "assigning");
export const removeManagerController = helperForManager(authService.removeAssignment, "removing");
