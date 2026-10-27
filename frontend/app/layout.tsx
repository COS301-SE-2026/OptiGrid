import type { ReactNode } from 'react';
import { Providers } from "./providers";
import { themeInitializationScript } from "../lib/theme";
import { displayPreferencesInitializationScript } from "../lib/displayPreferences";
import "../styles/optigrid-theme.css";

export const metadata = {
	title: "OptiGrid",
	description: "Energy intelligence platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
				<script dangerouslySetInnerHTML={{ __html: displayPreferencesInitializationScript }} />
			</head>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
