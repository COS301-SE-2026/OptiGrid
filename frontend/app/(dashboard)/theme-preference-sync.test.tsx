import { render, waitFor } from "@testing-library/react";
import { ThemePreferenceSync } from "./theme-preference-sync";

const mockSetPreference = jest.fn();

jest.mock("../theme-provider", () => ({
    isThemePreference: (value: unknown) => value === "light" || value === "dark" || value === "system",
    useTheme: () => ({ setPreference: mockSetPreference }),
}));

function replyWith(status: number, body: unknown) {
    global.fetch = jest.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body });
}

describe("ThemePreferenceSync", () => {
    beforeEach(() => {
        sessionStorage.clear();
        mockSetPreference.mockClear();
    });

    it("applies the account theme once per tab", async () => {
        replyWith(200, { theme: "dark" });

        const { unmount } = render(<ThemePreferenceSync userId="user-1" />);
        await waitFor(() => expect(mockSetPreference).toHaveBeenCalledWith("dark"));
        unmount();
        render(<ThemePreferenceSync userId="user-1" />);

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith("/api/preferences/theme", { cache: "no-store" });
        expect(sessionStorage.getItem("optigrid-theme-synced:user-1")).toBe("1");
    });

    it("ignores any missing or unknown answers", async () => {
        replyWith(401, { message: "Unauthorized" });
        render(<ThemePreferenceSync userId="user-1" />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());

        replyWith(200, { theme: "purple" });
        render(<ThemePreferenceSync userId="user-3" />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalled());

        expect(mockSetPreference).not.toHaveBeenCalled();
        expect(sessionStorage.getItem("optigrid-theme-synced:user-1")).toBeNull();
    });

    it("syncs again for a different user in the same tab", async () => {
        replyWith(200, { theme: "light" });
        sessionStorage.setItem("optigrid-theme-synced:user-1", "1");

        render(<ThemePreferenceSync userId="user-2" />);

        await waitFor(() => expect(mockSetPreference).toHaveBeenCalledWith("light"));
    });

});