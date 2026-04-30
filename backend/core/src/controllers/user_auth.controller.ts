import { Request, Response } from 'express';
import * as authService from '../services/user_auth.services';

export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body
        const user = await authService.signup(email, password, name);
            
        return res.status(201).json({
            message: 'User created successfully',
            user,
        });
    } 
    catch (error: any ) {
        //if user exist, we return 400, else its internal error
        if(error.message === 'User already exists, please login instead.') {
            return res.status(400).json({ 
                message: error.message 
            });
        }
        console.error('Signup error:', error);
        return res.status(500).json({
            message: 'Internal server error' 
        });
    }
};