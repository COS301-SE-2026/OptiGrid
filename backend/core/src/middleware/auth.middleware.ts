import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import prisma from "../lib/prisma";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// so these are the signing algorithms that we accept and everything else like "none" algorithm is rejected and offline
//this way the tokens can never be accepted wiz the signature stripped off or swapped and so on
const ALLOWED_JWT_ALGORITHMS = new Set(["ES256", "ES384", "ES512", "HS256", "HS384", "HS512", "RS256", "RS384", "RS512"]);

const supabaseClient =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey, {
				auth: {
					autoRefreshToken: false,
					persistSession: false,
				},
				realtime: {
					transport: WebSocket,
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

// i added this offline check before we trust Supabase with a network connection so it confirms the token is well-formed three-part JWS 
// it also check if the alogirthm header is allowed cuz some headers like "alg": "none" can be used to attack stripping the signsture
function acceptHeader(token: string): boolean {
	const parts = token.split(".");
	if (parts.length !== 3 || parts.some(function (part) {
		return part.length === 0;
	})) {
		return false;
	}
	try {
		const headerJson = Buffer.from(parts[0], "base64url").toString("utf8");
		const header = JSON.parse(headerJson) as { alg?: unknown };

		return typeof header.alg === "string" && ALLOWED_JWT_ALGORITHMS.has(header.alg);
	} catch {
		return false;
	}
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
	if (req.user) {
		return next();
	}

	const accessToken = extractBearerToken(req.header("authorization"));
	if (!accessToken || !acceptHeader(accessToken)) {
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
			select: { tenantId: true, roleType: true },
		});

		//the tenant_id must come from our own DB only. so because supabase user_metadata is client-writable, we cannot trust it as users can self-assign a tenant
		const userMetadata = {
			...(data.user.user_metadata ?? {}),
			tenant_id: profile?.tenantId ?? "",
		};

		req.user = {
			id: data.user.id,
			//now the roleType is resolved from our own DB only and never from user_metadata because 
			// otherwise a user could set their role as ADMIN and bypass the ownership checks (IDOR)
			roleType: profile?.roleType ?? "VIEWER",
			user_metadata: userMetadata,
		};

		return next();
	} catch (error) {
		console.error("Authentication middleware error:", error);
		return respondUnauthorized(res);
	}
}
