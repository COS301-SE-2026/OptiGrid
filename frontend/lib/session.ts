import { cookies } from "next/headers";

type SessionPayload = {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
};

export async function getSession(): Promise<SessionPayload | null> {
    const store = await cookies();
    const raw = store.get("optigrid_session")?.value;
    if (!raw) return null;
    try {
        return JSON.parse(decodeURIComponent(raw)) as SessionPayload;
    } catch {
        return null;
    }
}