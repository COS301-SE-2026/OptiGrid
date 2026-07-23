import { Request, Response } from 'express';
import * as authService from '../services/user_auth.services';
import {
    AccountAlreadyActiveError,
    AccountDeactivatedError,
    AccountNotFoundError,
} from '../errors/account.errors';

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
        return res.status(500).json({message: "Internal server error"});
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
