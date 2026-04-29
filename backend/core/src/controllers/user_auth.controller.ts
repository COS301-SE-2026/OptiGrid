import { Request, Response } from 'express';
import * as authService from '../services/user_auth.services';

export const signup = async (req: Request, res: Response) => {
    try {
        //we check and validate the fields are indeed filled in
        const { email, password, name } = req.body
        if(!email || !password || !name) return res.status(400).json({ message: 'Email, password and name are required fields.' });

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

// this function is used for login logic, we validate the email and password
export const login = async (req: Request, res: Response) => {
    //validating that the email and password fields are present
    try{
        const {email, password} = req.body;
        if(!email || !password){
            return res.status(400).json({message: "Email and password are required fields."});
        }
        const user = await authService.login(email, password);
        return res.status(200).json({
            message: 'Login successful',
            user,
        });
    }
    catch(error: any){
        if(error.message === "Invalid email or password"){
            return res.status(400).json({message: error.message});
        }
        console.error("Login error:", error);
        return res.status(500).json({message: "Internal server error"});
    }
}
