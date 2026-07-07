import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ThemePreference } from "@prisma/client";
import { updateThemeSchema } from "../validation/user_preferences.validation";

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

    if (!userId) return res.status(401).json({ status: "error", message: "Unauthorized" });

    try {
        const { theme } = updateThemeSchema.parse(req.body);
        await prisma.user.update({
            where: { userId: userId },
            data: { preferredTheme: theme.toUpperCase() as ThemePreference }
        });

        return res.json({ status: "success" });
    } catch (error: any) {
        if (error.name === "ZodError") {
            return res.status(400).json({ status: "error", message: "Invalid theme payload", details: error.errors });
        }

        console.error("Theme updating error:", error);
        return res.status(500).json({ status: "error", message: "Internal server error" });
    }
}