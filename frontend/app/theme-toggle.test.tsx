import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./theme-toggle";
import { ThemeProvider } from "./theme-provider";

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

function renderWithProvider(prefersDark = false) {
    window.matchMedia = mockMatchMedia(prefersDark);
    return render(
        <ThemeProvider>
            <ThemeToggle />
        </ThemeProvider>
    );
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
    it("renders a button", () => {
        renderWithProvider();
        expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("has correct aria-label in light mode", () => {
        renderWithProvider(false);
        expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to dark mode");
    });

    it("has correct aria-label in dark mode", () => {
        renderWithProvider(true);
        expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to light mode");
    });

    it("has correct title in light mode", () => {
        renderWithProvider(false);
        expect(screen.getByRole("button")).toHaveAttribute("title", "Dark mode");
    });

    it("has correct title in dark mode", () => {
        renderWithProvider(true);
        expect(screen.getByRole("button")).toHaveAttribute("title", "Light mode");
    });
    it("switches aria-label to light mode after clicking in dark mode", async () => {
        renderWithProvider(true);
        await userEvent.click(screen.getByRole("button"));
        expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to dark mode");
    });

    it("switches aria-label to dark mode after clicking in light mode", async () => {
        renderWithProvider(false);
        await userEvent.click(screen.getByRole("button"));
        expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Switch to light mode");
    });
});

describe("ThemeToggle API Sync", () => {
    beforeEach(() => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ status: "success" }),
            })
        ) as jest.Mock;
    });

    it("calls the backend API when toggled", async () => {
        renderWithProvider(false);
        const button = screen.getByRole("button");
        
        await userEvent.click(button);
        
        expect(global.fetch).toHaveBeenCalledWith(
            "/api/preferences/theme",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ theme: "dark" })
            })
        );
    });
});
