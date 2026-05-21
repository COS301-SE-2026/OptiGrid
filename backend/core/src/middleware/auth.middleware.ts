import type { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import prisma from "../lib/prisma";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const SESSION_COOKIE_NAME = "optigrid_session";
const allowSessionFallbackAuth = process.env.NODE_ENV !== "production";

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

function readCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
	if (!cookieHeader) {
		return null;
	}

	const segments = cookieHeader.split(";");
	for (const segment of segments) {
		const [name, ...valueParts] = segment.trim().split("=");
		if (name === cookieName) {
			const rawValue = valueParts.join("=").trim();
			return rawValue ? decodeURIComponent(rawValue) : null;
		}
	}

	return null;
}

type SessionPayload = {
	userId?: string;
	email?: string;
};

function parseSessionPayload(rawSession: string | null): SessionPayload | null {
	if (!rawSession) {
		return null;
	}

	try {
		return JSON.parse(rawSession) as SessionPayload;
	} catch {
		return null;
	}
}

async function trySessionCookieAuth(req: Request): Promise<boolean> {
	const rawCookieHeader = req.header("cookie");
	const sessionRaw = readCookieValue(rawCookieHeader, SESSION_COOKIE_NAME);
	const sessionPayload = parseSessionPayload(sessionRaw);

	if (!sessionPayload?.userId) {
		return false;
	}

	const profile = await prisma.user.findUnique({
		where: { userId: sessionPayload.userId },
		select: { tenantId: true },
	});

	if (!profile) {
		return false;
	}

	req.user = {
		id: sessionPayload.userId,
		user_metadata: {
			tenant_id: profile.tenantId ?? "",
		},
	};

	return true;
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction) {
	if (req.user) {
		return next();
	}

	const accessToken = extractBearerToken(req.header("authorization"));
	if (!accessToken) {
		if (allowSessionFallbackAuth) {
			const sessionAuthenticated = await trySessionCookieAuth(req);
			if (sessionAuthenticated) {
				return next();
			}
		}
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
			if (allowSessionFallbackAuth) {
				const sessionAuthenticated = await trySessionCookieAuth(req);
				if (sessionAuthenticated) {
					return next();
				}
			}
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
