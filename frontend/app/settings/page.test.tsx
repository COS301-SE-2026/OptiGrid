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
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

afterAll(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  (window.confirm as jest.Mock).mockImplementation(() => true);
  mockTheme = "light";
  global.fetch = jest.fn().mockResolvedValue({ ok: true });
});

const getFirstNameInput = () => screen.getByPlaceholderText(/enter first name/i) as HTMLInputElement;
const getLastNameInput = () => screen.getByPlaceholderText(/enter last name/i) as HTMLInputElement;
const getEmailInput = () => screen.getByPlaceholderText(/enter email address/i) as HTMLInputElement;
const getDeleteConfirmInput = () => screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;

describe("SettingsPage", () => {
  describe("Initial render", () => {
    it("renders the Settings heading", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument();
    });

    it("renders the subtitle", () => {
      render(<SettingsPage />);
      expect(screen.getByText(/manage your profile and account settings/i)).toBeInTheDocument();
    });

    it("renders the role badge", () => {
      render(<SettingsPage />);
      expect(screen.getByText("Admin")).toBeInTheDocument();
    });

    it("renders the Profile Information section", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /profile information/i })).toBeInTheDocument();
    });

    it("renders the Theme section", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /theme/i })).toBeInTheDocument();
    });

    it("renders the Help & Contact section", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /help & contact/i })).toBeInTheDocument();
    });

    it("renders the Account Management section", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /account management/i })).toBeInTheDocument();
    });

    it("pre-fills first name with 'Tali'", () => {
      render(<SettingsPage />);
      expect(getFirstNameInput().value).toBe("Tali");
    });

    it("pre-fills last name with 'Seaba'", () => {
      render(<SettingsPage />);
      expect(getLastNameInput().value).toBe("Seaba");
    });

    it("pre-fills email with 'Tali@example.com'", () => {
      render(<SettingsPage />);
      expect(getEmailInput().value).toBe("Tali@example.com");
    });

    it("renders the Role input as disabled", () => {
      render(<SettingsPage />);
      const roleInput = screen.getByDisplayValue("Admin");
      expect(roleInput).toBeDisabled();
    });

    it("does not show toast on initial render", () => {
      render(<SettingsPage />);
      expect(screen.queryByText(/profile changes saved/i)).not.toBeInTheDocument();
    });

    it("does not show delete modal on initial render", () => {
      render(<SettingsPage />);
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });
  });

  describe("Profile field updates", () => {
    it("updates first name on change", () => {
      render(<SettingsPage />);
      fireEvent.change(getFirstNameInput(), { target: { value: "John" } });
      expect(getFirstNameInput().value).toBe("John");
    });

    it("updates last name on change", () => {
      render(<SettingsPage />);
      fireEvent.change(getLastNameInput(), { target: { value: "Doe" } });
      expect(getLastNameInput().value).toBe("Doe");
    });

    it("updates email on change", () => {
      render(<SettingsPage />);
      fireEvent.change(getEmailInput(), { target: { value: "new@example.com" } });
      expect(getEmailInput().value).toBe("new@example.com");
    });
  });

  describe("Save Changes button", () => {
    it("renders the Save Changes button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("shows toast 'Profile changes saved' after clicking Save Changes", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      expect(screen.getByText(/profile changes saved/i)).toBeInTheDocument();
    });

    it("toast disappears after 3 seconds", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      expect(screen.getByText(/profile changes saved/i)).toBeInTheDocument();
      act(() => { jest.advanceTimersByTime(3000); });
      expect(screen.queryByText(/profile changes saved/i)).not.toBeInTheDocument();
    });

    it("saves profile with updated first name", () => {
      render(<SettingsPage />);
      fireEvent.change(getFirstNameInput(), { target: { value: "Updated" } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      expect(getFirstNameInput().value).toBe("Updated");
    });
  });

  describe("Reset button", () => {
    it("renders the Reset button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    });

    it("resets first name to 'Tali'", () => {
      render(<SettingsPage />);
      fireEvent.change(getFirstNameInput(), { target: { value: "Changed" } });
      fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      expect(getFirstNameInput().value).toBe("Tali");
    });

    it("resets last name to 'Seaba'", () => {
      render(<SettingsPage />);
      fireEvent.change(getLastNameInput(), { target: { value: "Changed" } });
      fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      expect(getLastNameInput().value).toBe("Seaba");
    });

    it("resets email to 'Tali@example.com'", () => {
      render(<SettingsPage />);
      fireEvent.change(getEmailInput(), { target: { value: "changed@email.com" } });
      fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      expect(getEmailInput().value).toBe("Tali@example.com");
    });

    it("shows toast 'Profile reset to default'", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      expect(screen.getByText(/profile reset to default/i)).toBeInTheDocument();
    });
  });

  describe("Theme toggle button", () => {
    it("renders the theme toggle button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("shows 'Light Mode' when theme is light", () => {
      render(<SettingsPage />);
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    it("shows 'Dark Mode' label when theme is dark", () => {
      mockTheme = "dark";
      render(<SettingsPage />);
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    });

    it("button label says 'Switch to Dark Mode' in light mode", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("button label says 'Switch to Light Mode' in dark mode", () => {
      mockTheme = "dark";
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
    });

    it("calls toggle when theme button is clicked", async () => {
      render(<SettingsPage />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
      });
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it("calls fetch to sync theme to backend", async () => {
      render(<SettingsPage />);
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
    it("renders the View Help link pointing to /help", () => {
      render(<SettingsPage />);
      const link = screen.getByRole("link", { name: /view help/i });
      expect(link).toHaveAttribute("href", "/help");
    });

    it("renders the Contact link pointing to /contact", () => {
      render(<SettingsPage />);
      const link = screen.getByRole("link", { name: /^contact$/i });
      expect(link).toHaveAttribute("href", "/contact");
    });
  });

  describe("Logout button", () => {
    it("renders the Logout button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    });

    it("calls window.confirm when Logout is clicked", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to logout?");
    });

    it("shows 'Logged out' toast after confirming logout", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      expect(screen.getByText(/logged out/i)).toBeInTheDocument();
    });

    it("redirects to /login after logout", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      act(() => { jest.advanceTimersByTime(500); });
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("does not redirect when logout is cancelled", () => {
      (window.confirm as jest.Mock).mockReturnValueOnce(false);
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      act(() => { jest.advanceTimersByTime(500); });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Delete Account button", () => {
    it("renders the Delete Account button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
    });

    it("opens the delete modal when Delete Account is clicked", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(screen.getByPlaceholderText(/type delete here/i)).toBeInTheDocument();
    });

    it("modal shows 'Delete Account' heading", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(screen.getByRole("heading", { name: /delete account/i })).toBeInTheDocument();
    });

    it("modal shows warning text about permanent deletion", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument();
    });

    it("modal has a Cancel button", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("modal has a Delete Account confirm button", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(screen.getAllByRole("button", { name: /delete account/i }).length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Cancel button (delete modal)", () => {
    it("closes the delete modal when Cancel is clicked", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });

    it("clears the delete confirm text when Cancel is clicked", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(getDeleteConfirmInput().value).toBe("");
    });
  });

  describe("Delete Account confirm button (modal)", () => {
    it("shows error toast if 'DELETE' is not typed", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "delete" } });
      const btns = screen.getAllByRole("button", { name: /delete account/i });
      fireEvent.click(btns[btns.length - 1]);
      expect(screen.getByText(/please type "DELETE" to confirm/i)).toBeInTheDocument();
    });

    it("keeps modal open if wrong text entered", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "wrong" } });
      const btns = screen.getAllByRole("button", { name: /delete account/i });
      fireEvent.click(btns[btns.length - 1]);
      expect(screen.getByPlaceholderText(/type delete here/i)).toBeInTheDocument();
    });

    it("shows 'Account deleted' toast when DELETE is typed correctly", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
      const btns = screen.getAllByRole("button", { name: /delete account/i });
      fireEvent.click(btns[btns.length - 1]);
      expect(screen.getByText(/account deleted/i)).toBeInTheDocument();
    });

    it("closes modal after successful DELETE confirmation", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
      const btns = screen.getAllByRole("button", { name: /delete account/i });
      fireEvent.click(btns[btns.length - 1]);
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });

    it("redirects to /login after account deletion", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
      const btns = screen.getAllByRole("button", { name: /delete account/i });
      fireEvent.click(btns[btns.length - 1]);
      act(() => { jest.advanceTimersByTime(500); });
      expect(mockPush).toHaveBeenCalledWith("/login");
    });

    it("clears the confirm input after successful deletion", () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      fireEvent.change(getDeleteConfirmInput(), { target: { value: "DELETE" } });
      const btns = screen.getAllByRole("button", { name: /delete account/i });
      fireEvent.click(btns[btns.length - 1]);
      fireEvent.click(screen.getByRole("button", { name: /delete account/i }));
      expect(getDeleteConfirmInput().value).toBe("");
    });
  });
});