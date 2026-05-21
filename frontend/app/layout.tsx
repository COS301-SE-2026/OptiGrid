import type { ReactNode } from 'react';
import { Providers } from "./providers";
import "../styles/optigrid-theme.css";

export const metadata = {
	title: "OptiGrid",
	description: "Energy intelligence platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}