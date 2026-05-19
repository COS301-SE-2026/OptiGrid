import type { ReactNode } from 'react';
import { Providers } from "./providers";
import "../styles/optigrid-theme.css";

export const metadata = {
	title: "OptiGrid",
	description: "Energy intelligence platform",
};

//root layout, like a wrapper, it wraps all pages
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
					<Providers>{children}</Providers>
			</body>
		</html>
	);
}
