import { render, screen } from "@testing-library/react";
import { Providers } from "./providers";

jest.mock("./theme-provider", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
}));
jest.mock("./tab-session-provider", () => ({
	TabSessionProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="tab-provider">{children}</div>,
}));

describe("Providers", () => {
	it("renders children wrapped in providers", () => {
		render(
			<Providers>
				<div data-testid="child">Test Child</div>
			</Providers>
		);

		expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
		expect(screen.getByTestId("tab-provider")).toBeInTheDocument();
		expect(screen.getByTestId("child")).toBeInTheDocument();
	});
});
