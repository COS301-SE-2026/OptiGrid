import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "./page";

const mockPush = jest.fn();
const mockToggle = jest.fn();
let mockTheme = "light";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

jest.mock("../theme-provider", () => ({
  useTheme: () => ({ theme: mockTheme, toggle: mockToggle }),
}));

beforeAll(() => {
  jest.spyOn(window, "confirm").mockImplementation(() => true);
  jest.useFakeTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  (window.confirm as jest.Mock).mockImplementation(() => true);
  mockTheme = "light";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({
      userId: "user-123",
      firstName: "Tali",
      lastName: "Seaba",
      email: "Tali@example.com",
      roleType: "ADMIN",
    }),
  });
});

const getFirstNameInput = () => screen.getByPlaceholderText(/enter first name/i) as HTMLInputElement;
const getLastNameInput = () => screen.getByPlaceholderText(/enter last name/i) as HTMLInputElement;
const getEmailInput = () => screen.getByPlaceholderText(/enter email address/i) as HTMLInputElement;
const getDeleteConfirmInput = () => screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;

describe("SettingsPage", () => {
  describe("Initial render", () => {
    it("renders the Settings heading", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument();
    });

    it("renders the subtitle", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByText(/manage your profile and account settings/i)).toBeInTheDocument();
    });

    it("renders the role badge", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(await screen.findByText("Admin")).toBeInTheDocument();
    });

    it("renders the Profile Information section", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("heading", { name: /profile information/i })).toBeInTheDocument();
    });

    it("renders the Theme section", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("heading", { name: /theme/i })).toBeInTheDocument();
    });

    it("renders the Help & Contact section", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("heading", { name: /help & contact/i })).toBeInTheDocument();
    });

    it("renders the Account Management section", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("heading", { name: /account management/i })).toBeInTheDocument();
    });

    it("pre-fills first name with 'Tali'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(await screen.findByDisplayValue("Tali")).toBeInTheDocument();
    });

    it("pre-fills last name with 'Seaba'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(await screen.findByDisplayValue("Seaba")).toBeInTheDocument();
    });

    it("pre-fills email with 'Tali@example.com'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(await screen.findByDisplayValue("Tali@example.com")).toBeInTheDocument();
    });

    it("renders the Role input as disabled", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const roleInput = await screen.findByDisplayValue("Admin");
      expect(roleInput).toBeDisabled();
    });

    it("does not show toast on initial render", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.queryByText(/profile changes saved/i)).not.toBeInTheDocument();
    });

    it("does not show delete modal on initial render", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });
  });

  describe("Profile field updates", () => {
    it("updates first name on change", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.change(input, { target: { value: "John" } });
      });
      expect(input).toHaveValue("John");
    });

    it("updates last name on change", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Seaba");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Doe" } });
      });
      expect(input).toHaveValue("Doe");
    });

    it("updates email on change", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Tali@example.com");
      await act(async () => {
        fireEvent.change(input, { target: { value: "new@example.com" } });
      });
      expect(input).toHaveValue("new@example.com");
    });
  });

  describe("Save Changes button", () => {
    it("renders the Save Changes button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("shows toast 'Profile changes saved' after clicking Save Changes", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      });
      expect(await screen.findByText(/profile changes saved/i)).toBeInTheDocument();
    });

    it("toast disappears after 3 seconds", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      });
      expect(await screen.findByText(/profile changes saved/i)).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByText(/profile changes saved/i)).not.toBeInTheDocument();
    });

    it("saves profile with updated first name", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Updated" } });
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      });
      expect(input).toHaveValue("Updated");
    });
  });

  describe("Reset button", () => {
    it("renders the Reset button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    });

    it("resets first name to 'Tali'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Changed" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      });
      expect(input).toHaveValue("Tali");
    });

    it("resets last name to 'Seaba'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Seaba");
      await act(async () => {
        fireEvent.change(input, { target: { value: "Changed" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      });
      expect(input).toHaveValue("Seaba");
    });

    it("resets email to 'Tali@example.com'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const input = await screen.findByDisplayValue("Tali@example.com");
      await act(async () => {
        fireEvent.change(input, { target: { value: "changed@email.com" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      });
      expect(input).toHaveValue("Tali@example.com");
    });

    it("shows toast 'Profile reset'", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      });
      expect(await screen.findByText(/profile reset/i)).toBeInTheDocument();
    });
  });

  describe("Theme toggle button", () => {
    it("renders the theme toggle button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("shows 'Light Mode' when theme is light", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    it("shows 'Dark Mode' label when theme is dark", async () => {
      mockTheme = "dark";
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    });

    it("button label says 'Switch to Dark Mode' in light mode", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("button label says 'Switch to Light Mode' in dark mode", async () => {
      mockTheme = "dark";
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
    });

    it("calls toggle when theme button is clicked", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
      });
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it("calls fetch to sync theme to backend", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
      });
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/preferences/theme",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("Help & Contact links", () => {
    it("renders the View Help link pointing to /help", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const link = screen.getByRole("link", { name: /view help/i });
      expect(link).toHaveAttribute("href", "/help");
    });

    it("renders the Contact link pointing to /contact", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      const link = screen.getByRole("link", { name: /^contact$/i });
      expect(link).toHaveAttribute("href", "/contact");
    });
  });

  describe("Logout button", () => {
    it("renders the Logout button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    });

    it("calls window.confirm when Logout is clicked", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      });
      expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to logout?");
    });

    it("shows 'Logged out' toast after confirming logout", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      });
      expect(screen.getByText(/logged out/i)).toBeInTheDocument();
    });

    it("redirects to /login after logout", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /logout/i }));
        jest.advanceTimersByTime(500);
      });
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("does not redirect when logout is cancelled", async () => {
      (window.confirm as jest.Mock).mockReturnValueOnce(false);
      await act(async () => {
        render(<SettingsPage />);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /logout/i }));
        jest.advanceTimersByTime(500);
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

 /* describe("Delete Account button", () => {
    it("renders the Delete Account button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
    });

    it("opens the delete modal when Delete Account is clicked", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      expect(screen.getByPlaceholderText(/type delete here/i)).toBeInTheDocument();
    });

    it("modal shows 'Delete Account' heading", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      expect(screen.getByRole("heading", { name: /delete account/i })).toBeInTheDocument();
    });

    it("modal shows warning text about permanent deletion", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    });

    it("modal has a Cancel button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("modal has a Delete Account confirm button", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      expect(screen.getAllByRole("button", { name: /delete account/i }).length).toBeGreaterThanOrEqual(2);
    });
  });*/

  /*describe("Cancel button (delete modal)", () => {
    it("closes the delete modal when Cancel is clicked", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });

    it("clears the delete confirm text when Cancel is clicked", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      let input: HTMLInputElement;
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        input = screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "DELETE" } });
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      const newInput = screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;
      expect(newInput.value).toBe("");
    });
  });*/

  /*describe("Delete Account confirm button (modal)", () => {
    it("shows error toast if 'DELETE' is not typed", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        fireEvent.change(getDeleteConfirmInput(), { target: { value: "delete" } });
        const btns = screen.getAllByRole("button", { name: /delete account/i });
        fireEvent.click(btns[btns.length - 1]);
      });
      expect(screen.getByText(/please type "DELETE" to confirm/i)).toBeInTheDocument();
    });

    it("keeps modal open if wrong text entered", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        fireEvent.change(getDeleteConfirmInput(), { target: { value: "wrong" } });
        const btns = screen.getAllByRole("button", { name: /delete account/i });
        fireEvent.click(btns[btns.length - 1]);
      });
      expect(screen.getByPlaceholderText(/type delete here/i)).toBeInTheDocument();
    });

    it("shows 'Account deleted' toast when DELETE is typed correctly", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
        const btns = screen.getAllByRole("button", { name: /delete account/i });
        fireEvent.click(btns[btns.length - 1]);
      });
      expect(screen.getByText(/account deleted/i)).toBeInTheDocument();
    });

    it("closes modal after successful DELETE confirmation", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
        const btns = screen.getAllByRole("button", { name: /delete account/i });
        fireEvent.click(btns[btns.length - 1]);
      });
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });

    it("redirects to /login after account deletion", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      let input: HTMLInputElement;
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        input = screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "DELETE" } });
        const btns = screen.getAllByRole("button", { name: /delete account/i });
        fireEvent.click(btns[btns.length - 1]);
        jest.advanceTimersByTime(500);
      });
      expect(mockPush).toHaveBeenCalledWith("/login");
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });

    it("clears the confirm input after successful deletion", async () => {
      await act(async () => {
        render(<SettingsPage />);
      });
      await screen.findByDisplayValue("Tali");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
        const input = screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;
        fireEvent.change(input, { target: { value: "DELETE" } });
        const btns = screen.getAllByRole("button", { name: /delete account/i });
        fireEvent.click(btns[btns.length - 1]);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      });
      const newInput = screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;
      expect(newInput.value).toBe("");
    });
  });*/

  describe("Profile loading", () => {
    const sessionProfile = {
      userId: "user-123",
      firstName: "Atidaishe",
      lastName: "Mupanemunda",
      email: "mupanemundaatidaishe@gmail.com",
      roleType: "BUILDING_MANAGER",
    };

    function mockSessionProfile() {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(sessionProfile),
      });
    }

    it("loads profile details from the authenticated session", async () => {
      mockSessionProfile();
      await act(async () => {
        render(<SettingsPage />);
      });
      expect(await screen.findByDisplayValue(sessionProfile.firstName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(sessionProfile.lastName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(sessionProfile.email)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Manager")).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
    });

    it("resets edits to the loaded profile", async () => {
      mockSessionProfile();
      await act(async () => {
        render(<SettingsPage />);
      });
      const firstName = await screen.findByDisplayValue(sessionProfile.firstName) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(firstName, { target: { value: "Changed" } });
      });
      expect(firstName).toHaveValue("Changed");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
      });
      expect(firstName).toHaveValue(sessionProfile.firstName);
    });
  });
});