import type { ReactNode } from 'react';

//root layout, like a wrapper, it wraps all pages
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
