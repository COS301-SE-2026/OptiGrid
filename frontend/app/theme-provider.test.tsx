import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeConsumer() {
    const { theme, toggle } = useTheme();
    return (
        <div>
            <span data-testid="theme">{theme}</span>
            <button onClick={toggle}>Toggle</button>
        </div>
    );
}

function mockMatchMedia(prefersDark: boolean) {
    return jest.fn().mockImplementation((query: string) => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    }));
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
});

describe("ThemeProvider", () => {
    it("defaults to light when no saved theme and system prefers light", () => {
        window.matchMedia = mockMatchMedia(false);
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("theme")).toHaveTextContent("light");
        expect(document.documentElement).not.toHaveClass("dark");
        expect(document.documentElement).toHaveAttribute("data-theme", "light");
    });

    it("reads system preference and applies dark when system prefers dark", () => {
        window.matchMedia = mockMatchMedia(true);
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(document.documentElement).toHaveClass("dark");
        
        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });

    it("uses saved theme from localStorage over system preference", () => {
        window.matchMedia = mockMatchMedia(true);
        localStorage.setItem("optigrid-theme", "light");
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("theme")).toHaveTextContent("light");
        expect(document.documentElement).not.toHaveClass("dark");
    });

    it("persists saved dark theme from localStorage", () => {
        window.matchMedia = mockMatchMedia(false);
        localStorage.setItem("optigrid-theme", "dark");
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(document.documentElement).toHaveClass("dark");
        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });

    it("toggles from light to dark and updates localStorage and document", async () => {
        window.matchMedia = mockMatchMedia(false);
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        await userEvent.click(screen.getByRole("button", { name: "Toggle" }));

        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(localStorage.getItem("optigrid-theme")).toBe("dark");
        expect(document.documentElement).toHaveClass("dark");
        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });

    it("toggles from dark back to light and updates localStorage and document", async () => {
        window.matchMedia = mockMatchMedia(true);
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);

        await userEvent.click(screen.getByRole("button", { name: "Toggle" }));

        expect(screen.getByTestId("theme")).toHaveTextContent("light");

        expect(localStorage.getItem("optigrid-theme")).toBe("light");
        expect(document.documentElement).not.toHaveClass("dark");
        expect(document.documentElement).toHaveAttribute("data-theme", "light");
    });

    it("provides a default context value when used outside the provider", () => {
        render(<ThemeConsumer />);
        expect(screen.getByTestId("theme")).toHaveTextContent("light");
    });
});