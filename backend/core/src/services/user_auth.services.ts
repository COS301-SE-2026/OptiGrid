import prisma from '../lib/prisma';
import { hashPassword } from '../lib/password';
import { randomUUID } from 'crypto';

//This function is used for the signup logic
export const signup = async (email: string, password: string, name: string) => {
    //we check if user exists, and if so he should login
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) throw new Error('User already exists, please login instead.');

    //we hash passwords, split name and then add to supabase via prisma client
    const hashPass = await hashPassword(password);
    const firstName = name.split(' ')[0];
    const lastName = name.split(' ')[1] || '';
    
    const createData: any = {
        userId: randomUUID(),
        email,
        passwordHash: hashPass,
        firstName,
        lastName,
    };

    const user = await (prisma.user as any).create({
        data: createData,
        //we ensure not to show the password hash or return to frontend side
        select: {
            userId: true,
            email: true,
            firstName: true,
            lastName: true,
        },
    });

    return user;
};