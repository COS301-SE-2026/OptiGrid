"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export function LogoutButton() {
	const router = useRouter();

	const handleLogout = async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
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
