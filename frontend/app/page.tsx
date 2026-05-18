import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function HomePage() {
	const cookieStore = await cookies();
	const session = cookieStore.get("optigrid_session");
	if (session?.value) {
		redirect("/dashboard");
	}

	redirect("/login");
}
