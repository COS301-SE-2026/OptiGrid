import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ThemePreference } from "@prisma/client";

export async function getUserTheme(req: Request, res: Response) {
    const userId = req.user?.id; // No more (req as any)
    if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

    const user = await prisma.user.findUnique({
        where: { userId: userId },
        select: { preferredTheme: true }
    });

    return res.json({ theme: user?.preferredTheme.toLowerCase() });
}

export async function updateUserTheme(req: Request, res: Response) {
    const userId = req.user?.id;
    const { theme } = req.body;

    if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

    await prisma.user.update({
        where: { userId: userId },
        data: { preferredTheme: theme.toUpperCase() as ThemePreference }
    });

    return res.json({ status: "success" });
}