"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export function LogoutButton() {
	const router = useRouter();

	const handleLogout = async () => {
		try {
			const supabase = createClient();
			await supabase.auth.signOut();
		} catch (err) {
			console.warn("Supabase signout skipped or failed:", err);
		}
		
		await fetch("/api/auth/logout", { method: "POST" });
		router.push("/login?loggedOut=1");
		router.refresh();
	};

	return (
		<button type="button" onClick={handleLogout} className="btn btn-secondary logout-button">
			Logout
		</button>
	);
}
