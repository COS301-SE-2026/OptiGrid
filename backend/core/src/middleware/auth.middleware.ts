import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import prisma from "../lib/prisma";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseClient =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
		  })
		: null;

function extractBearerToken(rawAuthorizationHeader: string | undefined): string | null {
	if (!rawAuthorizationHeader) {
		return null;
	}

	const [scheme, token] = rawAuthorizationHeader.trim().split(/\s+/);
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return null;
	}

	return token;
}

function respondUnauthorized(res: Response) {
	return res.status(401).json({ status: "error", message: "Unauthorized" });
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
	if (req.user) {
		return next();
	}

	const accessToken = extractBearerToken(req.header("authorization"));
	if (!accessToken) {
		return respondUnauthorized(res);
	}

	if (!supabaseClient) {
		return res.status(500).json({
			status: "error",
			message: "Authentication is not configured on the server.",
		});
	}

	try {
		const { data, error } = await supabaseClient.auth.getUser(accessToken);

		if (error || !data.user?.id) {
			return respondUnauthorized(res);
		}

		const profile = await prisma.user.findUnique({
			where: { userId: data.user.id },
			select: { tenantId: true },
		});

		const userMetadata = {
			...(data.user.user_metadata ?? {}),
			tenant_id: profile?.tenantId ?? data.user.user_metadata?.tenant_id ?? "",
		};

		req.user = {
			id: data.user.id,
			user_metadata: userMetadata,
		};

		return next();
	} catch (error) {
		console.error("Authentication middleware error:", error);
		return respondUnauthorized(res);
	}
}

