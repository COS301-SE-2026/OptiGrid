import { THEME_STORAGE_KEY, themeInitializationScript } from "../lib/theme";

function mockMatchMedia(prefersDark: boolean) {
  return jest.fn().mockImplementation(() => ({ matches: prefersDark }));
}

function runThemeInitializationScript() {
  new Function(themeInitializationScript)();
}

describe("themeInitializationScript", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("color-scheme");
  });

  it("applies a saved dark theme before React hydrates", () => {
    window.matchMedia = mockMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    runThemeInitializationScript();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("falls back to the operating-system preference", () => {
    window.matchMedia = mockMatchMedia(true);

    runThemeInitializationScript();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
