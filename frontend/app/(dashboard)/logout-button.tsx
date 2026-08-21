"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
	const router = useRouter();

	const handleLogout = async () => {
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
