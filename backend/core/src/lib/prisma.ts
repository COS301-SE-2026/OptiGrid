import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prismaClientSingleton = () => {
	// Ensure DATABASE_URL is set correctly else Prisma likes to act up
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');

	return new PrismaClient({
		adapter: new PrismaPg({
			connectionString: databaseUrl,
		}),
	});
};
const prisma = global.prisma ?? prismaClientSingleton();

declare global { var prisma: undefined | ReturnType<typeof prismaClientSingleton>; }
export default prisma;
//prevent duplicate prisma instances
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;