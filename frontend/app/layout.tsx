import type { ReactNode } from "react";

import "../styles/optigrid-theme.css";

export const metadata = {
	title: "OptiGrid",
	description: "Energy intelligence for every building.",
};

//root layout, like a wrapper, it wraps all pages
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}