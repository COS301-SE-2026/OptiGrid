import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeConsumer() {
    const { theme, preference, setPreference, toggle } = useTheme();
    return (
        <div>
            <span data-testid="theme">{theme}</span>
            <span data-testid="preference">{preference}</span>
            <button onClick={toggle}>Toggle</button>
            <button onClick={() => setPreference("system")}>Use system</button>
            <button onClick={() => setPreference("dark")}>Use dark</button>
        </div>
    );
}

function controllableMatchMedia(initiallyDark: boolean) {
    const listeners = new Set<() => void>();
    const query = {
        matches: initiallyDark,
        media: "(prefers-color-scheme: dark)",
        addEventListener: jest.fn((_type: string, listener: () => void) => listeners.add(listener)),
        removeEventListener: jest.fn((_type: string, listener: () => void) => listeners.delete(listener)),
    };
    return {
        matchMedia: jest.fn(() => query),
        setDark(dark: boolean) {
            query.matches = dark;
            listeners.forEach((listener) => listener());
        },
        listenerCount: () => listeners.size,
    };
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

    it("treats a missing choice as following the device", () => {
        window.matchMedia = mockMatchMedia(false);
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("preference")).toHaveTextContent("system");
    });

    it("restores a saved system choice", () => {
        window.matchMedia = mockMatchMedia(true);
        localStorage.setItem("optigrid-theme", "system");
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("preference")).toHaveTextContent("system");
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    });

    it("follows the device live while the system choice is active", async () => {
        const device = controllableMatchMedia(false);
        window.matchMedia = device.matchMedia as unknown as typeof window.matchMedia;
        localStorage.setItem("optigrid-theme", "system");
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(screen.getByTestId("theme")).toHaveTextContent("light");

        act(() => device.setDark(true));

        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    });

    it("saves the system choice and applies the device theme at once", async () => {
        window.matchMedia = mockMatchMedia(true);
        localStorage.setItem("optigrid-theme", "light");
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);

        await userEvent.click(screen.getByRole("button", { name: "Use system" }));

        expect(localStorage.getItem("optigrid-theme")).toBe("system");
        expect(screen.getByTestId("preference")).toHaveTextContent("system");
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    });

    it("stops following the device when a fixed theme is picked", async () => {
        const device = controllableMatchMedia(false);
        window.matchMedia = device.matchMedia as unknown as typeof window.matchMedia;
        localStorage.setItem("optigrid-theme", "system");
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
        expect(device.listenerCount()).toBe(1);

        await userEvent.click(screen.getByRole("button", { name: "Use dark" }));
        act(() => device.setDark(false));

        expect(device.listenerCount()).toBe(0);
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(localStorage.getItem("optigrid-theme")).toBe("dark");
    });


    it("still applies a theme when storage is blocked", async () => {
        window.matchMedia = mockMatchMedia(false);
        const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);

        await userEvent.click(screen.getByRole("button", { name: "Use dark" }));

        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        setItem.mockRestore();
    });
});
