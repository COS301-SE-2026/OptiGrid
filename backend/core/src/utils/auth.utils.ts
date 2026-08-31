import { Request } from 'express';
import prisma from '../lib/prisma';

//checks if user has access to building
export async function checkBuildingAccess(req: Request, buildingId: string): Promise<boolean> {
	if (req.user?.roleType === 'ADMIN') return true;
	
	if (!req.user) return false;

	const access = await prisma.userBuildingAccess.findUnique({
		where: {
			user_id_building_id: {
				user_id: req.user.id,
				building_id: buildingId,
			},
		},
	});
	return !!access;
}

//returns list of building ids user has access to
export async function getAllowedBuildingIds(req: Request): Promise<string[]> {
	if (req.user?.roleType === 'ADMIN') {
		const buildings = await prisma.building.findMany({ select: { building_id: true } });
		return buildings.map(b => b.building_id);
	}
	
	if (!req.user) return [];

	const accesses = await prisma.userBuildingAccess.findMany({
		where: { user_id: req.user.id },
		select: { building_id: true },
	});
	
	return accesses.map(a => a.building_id);
}
