import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "./page";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockSetPreference = jest.fn();
const mockToggle = jest.fn();

let mockTheme: "light" | "dark" = "light";
let mockPreference: "light" | "dark" | "system" = "light";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

jest.mock("@/app/theme-provider", () => ({
  useTheme: () => ({
    theme: mockTheme,
    preference: mockPreference,
    setPreference: mockSetPreference,
    toggle: mockToggle,
  }),
}));

type FakeReply = { status?: number; body?: unknown; headers?: Record<string, string> };
type FakeRoute = FakeReply | ((init?: RequestInit) => FakeReply | Promise<FakeReply>);

const account = {
  user: {
    userId: "user-123",
    email: "thandi@example.com",
    firstName: "Thandi",
    lastName: "Mokoena",
    roleType: "BUILDING_MANAGER",
    preferredTheme: "light",
    createdAt: "2026-03-02T08:15:00.000Z",
  },
  security: {
    signInMethods: ["email"],
    canChangePassword: true,
    lastSignInAt: "2026-10-25T07:58:12.000Z",
  },
};

let routes: Record<string, FakeRoute>;

function installFetch() {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    const route = routes[`${method} ${url}`];
    if (!route) {
      throw new Error(`Unexpected request ${method} ${url}`);
    }
    const reply = typeof route === "function" ? await route(init) : route;
    const status = reply.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(reply.headers ?? {}),
      json: async () => reply.body ?? {},
      blob: async () => new Blob([JSON.stringify(reply.body ?? {})], { type: "application/json" }),
    } as unknown as Response;
  }) as jest.Mock;
}

function requestsTo(method: string, url: string): RequestInit[] {
  return (global.fetch as jest.Mock).mock.calls
    .filter(([input, init]) => String(input) === url && (init?.method ?? "GET") === method)
    .map(([, init]) => init as RequestInit);
}

function bodyOf(init: RequestInit) {
  return JSON.parse(String(init.body));
}

async function renderLoaded() {
  render(<SettingsPage />);
  await screen.findByDisplayValue("Thandi");
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "confirm").mockReturnValue(true);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  mockTheme = "light";
  mockPreference = "light";
  routes = {
    "GET /api/accounts/me": { body: account },
    "GET /api/auth/me": {
      body: { userId: "user-123", email: "thandi@example.com", firstName: "Thandi", lastName: "Mokoena", roleType: "BUILDING_MANAGER" },
    },
    "PUT /api/preferences/theme": { body: { status: "success" } },
    "POST /api/auth/logout": { body: {} },
  };
  installFetch();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("SettingsPage", () => {
  describe("loading the account", () => {
    it("shows the saved profile under the page heading", async () => {
      await renderLoaded();

      expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
      expect(screen.getByText("Manage your account and how OptiGrid looks and runs.")).toBeInTheDocument();
      expect(screen.getByLabelText("First name")).toHaveValue("Thandi");
      expect(screen.getByLabelText("Last name")).toHaveValue("Mokoena");
      expect(screen.getByLabelText("Email address")).toHaveValue("thandi@example.com");
      expect(screen.getByLabelText("Email address")).toBeDisabled();
      expect(screen.getByLabelText("Role")).toHaveValue("Manager");
      expect(screen.getByLabelText("Role")).toBeDisabled();
      expect(screen.getByText(/Member since/)).toBeInTheDocument();
      expect(screen.getByText("TM")).toBeInTheDocument();
      expect(requestsTo("GET", "/api/accounts/me")).toHaveLength(1);
    });

    it("falls back to the session when the account service fails and offers a retry", async () => {
      routes["GET /api/accounts/me"] = { status: 502, body: { message: "Unable to reach the account service" } };

      await renderLoaded();

      expect(screen.getByRole("alert")).toHaveTextContent("Some account details could not be loaded");
      expect(screen.getByText(/could not check how you sign in/i)).toBeInTheDocument();

      routes["GET /api/accounts/me"] = { body: account };
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("button", { name: "Change password" })).toBeInTheDocument();
      expect(screen.queryByText(/Some account details could not be loaded/)).not.toBeInTheDocument();
    });
  });

  describe("profile", () => {
    it("only enables saving once something changed", async () => {
      await renderLoaded();
      const save = screen.getByRole("button", { name: "Save changes" });
      expect(save).toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();

      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Lerato" } });

      expect(save).toBeEnabled();
      expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();
      expect(screen.getByText("LM")).toBeInTheDocument();
    });

    it("discards edits back to the saved names", async () => {
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Changed" } });
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Name" } });

      fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

      expect(screen.getByLabelText("First name")).toHaveValue("Thandi");
      expect(screen.getByLabelText("Last name")).toHaveValue("Mokoena");
      expect(screen.queryByText("You have unsaved changes.")).not.toBeInTheDocument();
    });

    it("blocks an empty first name without calling the server", async () => {
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "   " } });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Enter your first name.")).toBeInTheDocument();
      expect(screen.getByLabelText("First name")).toHaveAttribute("aria-invalid", "true");
      expect(requestsTo("PUT", "/api/accounts/me")).toHaveLength(0);
    });

    it("rejects digits in a name", async () => {
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "M0koena" } });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText(/Use letters for names/)).toBeInTheDocument();
      expect(requestsTo("PUT", "/api/accounts/me")).toHaveLength(0);
    });

    it("saves tidy names, refreshes the sidebar and confirms", async () => {
      routes["PUT /api/accounts/me"] = (init) => ({
        body: { message: "Profile updated", user: { ...account.user, ...bodyOf(init!) } },
      });
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "  Lerato  " } });
      fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "van  der Merwe" } });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("Profile saved")).toBeInTheDocument();
      expect(bodyOf(requestsTo("PUT", "/api/accounts/me")[0])).toEqual({ firstName: "Lerato", lastName: "van der Merwe" });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText("First name")).toHaveValue("Lerato");
      expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    });

    it("shows a field error sent back by the server", async () => {
      routes["PUT /api/accounts/me"] = {
        status: 400,
        body: { message: "Validation error", errors: [{ field: "firstName", message: "First name can be at most 60 characters." }] },
      };
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Lerato" } });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText("First name can be at most 60 characters.")).toBeInTheDocument();
    });

    it("explains when saving fails", async () => {
      routes["PUT /api/accounts/me"] = { status: 500, body: { message: "Internal server error" } };
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Lerato" } });

      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("We could not save your profile. Please try again.");
      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  describe("appearance", () => {
    it("marks the current theme among the three choices", async () => {
      await renderLoaded();

      expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
      expect(screen.getByRole("radio", { name: "System" })).not.toBeChecked();
    });

    it("applies a new theme straight away and saves it to the account", async () => {
      await renderLoaded();

      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

      expect(mockSetPreference).toHaveBeenCalledWith("dark");
      expect(bodyOf(requestsTo("PUT", "/api/preferences/theme")[0])).toEqual({ theme: "dark" });
      expect(await screen.findByText("Saved to your account. It follows you to other devices.")).toBeInTheDocument();
    });

    it("says when the choice could only be kept on this device", async () => {
      routes["PUT /api/preferences/theme"] = { status: 502, body: {} };
      await renderLoaded();

      fireEvent.click(screen.getByRole("radio", { name: "System" }));

      expect(await screen.findByText(/Saved on this device only/)).toBeInTheDocument();
    });

    it("describes the device mode when following the system", async () => {
      mockPreference = "system";
      mockTheme = "dark";
      await renderLoaded();

      expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
      expect(screen.getByText("Following your device, which is in dark mode right now.")).toBeInTheDocument();
    });
  });

  describe("security", () => {
    function security() {
      return within(screen.getByRole("region", { name: "Security" }));
    }

    async function openPasswordForm() {
      await renderLoaded();
      fireEvent.click(screen.getByRole("button", { name: "Change password" }));
      return within(screen.getByRole("form", { name: "Change password" }));
    }

    function fillPasswordForm(form: ReturnType<typeof within>, current: string, next: string, confirm = next) {
      fireEvent.change(form.getByLabelText("Current password"), { target: { value: current } });
      fireEvent.change(form.getByLabelText("New password"), { target: { value: next } });
      fireEvent.change(form.getByLabelText("Confirm new password"), { target: { value: confirm } });
    }

    it("shows how the user signs in", async () => {
      await renderLoaded();

      expect(security().getByText("Email and password")).toBeInTheDocument();
      expect(security().getByText("Last sign-in")).toBeInTheDocument();
    });

    it("hides the password form for Google accounts", async () => {
      routes["GET /api/accounts/me"] = {
        body: { ...account, security: { signInMethods: ["google"], canChangePassword: false, lastSignInAt: null } },
      };
      await renderLoaded();

      expect(screen.queryByRole("button", { name: "Change password" })).not.toBeInTheDocument();
      expect(security().getByText(/no OptiGrid password to change/)).toBeInTheDocument();
      expect(security().getByRole("link", { name: "Manage your Google password" })).toHaveAttribute(
        "href",
        "https://myaccount.google.com/security",
      );
    });

    it("ticks each password rule as it is met", async () => {
      const form = await openPasswordForm();
      expect(form.getByLabelText("Current password")).toHaveFocus();

      fireEvent.change(form.getByLabelText("New password"), { target: { value: "abcdefgh" } });
      expect(form.getByText("At least 8 characters").closest("li")).toHaveClass("is-met");
      expect(form.getByText("At least one symbol").closest("li")).not.toHaveClass("is-met");
      expect(form.getByText("Strength: Weak")).toBeInTheDocument();

      fireEvent.change(form.getByLabelText("New password"), { target: { value: "abcdefgh1" } });
      expect(form.getByText("At least one number").closest("li")).toHaveClass("is-met");
      expect(form.getByText("Strength: Fair")).toBeInTheDocument();

      fireEvent.change(form.getByLabelText("New password"), { target: { value: "Abcdefgh1!xyz" } });
      expect(form.getByText("Strength: Strong")).toBeInTheDocument();
    });

    it("catches a mismatched confirmation before sending", async () => {
      routes["POST /api/accounts/me/password"] = { body: { message: "Password changed" } };
      const form = await openPasswordForm();
      fillPasswordForm(form, "OldPass123!", "NewPass456!", "NewPass456?");

      fireEvent.click(form.getByRole("button", { name: "Update password" }));

      expect(await form.findByText("The new passwords do not match.")).toBeInTheDocument();
      expect(requestsTo("POST", "/api/accounts/me/password")).toHaveLength(0);
    });

    it("says up front that other devices will be signed out", async () => {
      const form = await openPasswordForm();

      expect(form.getByText("Changing your password signs you out on your other devices. You stay signed in here.")).toBeInTheDocument();
      expect(form.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("changes the password and confirms that other devices were signed out", async () => {
      routes["POST /api/accounts/me/password"] = { body: { message: "Password changed", signedOutOtherDevices: true } };
      const form = await openPasswordForm();
      fillPasswordForm(form, "OldPass123!", "NewPass456!");

      fireEvent.click(form.getByRole("button", { name: "Update password" }));

      expect(await screen.findByText("Password updated. Your other devices were signed out.")).toBeInTheDocument();
      expect(bodyOf(requestsTo("POST", "/api/accounts/me/password")[0])).toEqual({
        currentPassword: "OldPass123!",
        newPassword: "NewPass456!",
      });
      expect(screen.queryByRole("form", { name: "Change password" })).not.toBeInTheDocument();
    });

    it("asks the user to sign in again when Supabase wants a fresh sign in", async () => {
      routes["POST /api/accounts/me/password"] = {
        status: 409,
        body: { code: "REAUTHENTICATION_NEEDED", message: "Please sign out and sign in again, then change your password." },
      };
      const form = await openPasswordForm();
      fillPasswordForm(form, "OldPass123!", "NewPass456!");

      fireEvent.click(form.getByRole("button", { name: "Update password" }));

      expect(await form.findByRole("alert")).toHaveTextContent("Please sign out and sign in again, then change your password.");
    });

    it("shows a wrong current password next to that field", async () => {
      routes["POST /api/accounts/me/password"] = {
        status: 400,
        body: { code: "INVALID_CURRENT_PASSWORD", field: "currentPassword", message: "Your current password is not correct." },
      };
      const form = await openPasswordForm();
      fillPasswordForm(form, "WrongPass1!", "NewPass456!");

      fireEvent.click(form.getByRole("button", { name: "Update password" }));

      expect(await form.findByText("Your current password is not correct.")).toBeInTheDocument();
      expect(form.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
    });

    it("explains rate limiting in plain words", async () => {
      routes["POST /api/accounts/me/password"] = { status: 429, body: { message: "Please try again later. Too many requests" } };
      const form = await openPasswordForm();
      fillPasswordForm(form, "OldPass123!", "NewPass456!");

      fireEvent.click(form.getByRole("button", { name: "Update password" }));

      expect(await form.findByRole("alert")).toHaveTextContent("Too many attempts. Wait a minute, then try again.");
    });

    it("returns focus to the button when the form is cancelled", async () => {
      const form = await openPasswordForm();

      fireEvent.click(form.getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("button", { name: "Change password" })).toHaveFocus();
    });

    it("signs out everywhere after confirming and sends the user to log in", async () => {
      routes["POST /api/accounts/me/sign-out-everywhere"] = { body: { redirectTo: "/login?signedOut=all" } };
      await renderLoaded();

      fireEvent.click(security().getByRole("button", { name: "Sign out everywhere" }));
      const dialog = await screen.findByRole("dialog", { name: "Sign out of all devices?" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign out everywhere" }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login?signedOut=all"));
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("keeps the dialog open with a message when signing out everywhere fails", async () => {
      routes["POST /api/accounts/me/sign-out-everywhere"] = { status: 500, body: { message: "Internal server error" } };
      await renderLoaded();

      fireEvent.click(security().getByRole("button", { name: "Sign out everywhere" }));
      const dialog = await screen.findByRole("dialog", { name: "Sign out of all devices?" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Sign out everywhere" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("We could not sign you out everywhere.");
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("closes the sign out dialog on cancel", async () => {
      await renderLoaded();

      fireEvent.click(security().getByRole("button", { name: "Sign out everywhere" }));
      const dialog = await screen.findByRole("dialog", { name: "Sign out of all devices?" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog", { name: "Sign out of all devices?" })).not.toBeInTheDocument();
    });
  });

  describe("your data", () => {
    beforeEach(() => {
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:optigrid") });
      Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
    });

    it("downloads the export with the name the server chose", async () => {
      const clicks: Array<{ download: string; href: string }> = [];
      jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
        clicks.push({ download: this.download, href: this.href });
      });
      routes["GET /api/accounts/me/export"] = {
        body: { exportedAt: "2026-10-25T08:00:00.000Z" },
        headers: { "content-disposition": 'attachment; filename="optigrid-my-data-2026-10-25.json"' },
      };
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: "Download my data" }));

      expect(await screen.findByText("Saved as optigrid-my-data-2026-10-25.json")).toBeInTheDocument();
      expect(clicks).toEqual([{ download: "optigrid-my-data-2026-10-25.json", href: "blob:optigrid" }]);
      expect(screen.getByText("Your data is downloading")).toBeInTheDocument();
    });

    it("explains when the export cannot be prepared", async () => {
      routes["GET /api/accounts/me/export"] = { status: 429, body: {} };
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: "Download my data" }));

      expect(await screen.findByText("Too many attempts. Wait a minute, then try again.")).toBeInTheDocument();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe("account management", () => {
    it("logs out after confirming and redirects", async () => {
      await renderLoaded();
      jest.useFakeTimers();

      fireEvent.click(screen.getByRole("button", { name: "Logout" }));
      await act(async () => {
        await Promise.resolve();
      });

      expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to logout?");
      expect(requestsTo("POST", "/api/auth/logout")).toHaveLength(1);
      expect(screen.getByText("Logged out")).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(500);
      });
      expect(mockPush).toHaveBeenCalledWith("/login?loggedOut=1");
    });

    it("stays put when logout is cancelled", async () => {
      (window.confirm as jest.Mock).mockReturnValue(false);
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: "Logout" }));

      expect(requestsTo("POST", "/api/auth/logout")).toHaveLength(0);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("hides the toast after three seconds", async () => {
      jest.useFakeTimers();
      routes["PUT /api/accounts/me"] = { body: { user: { ...account.user, firstName: "Lerato" } } };
      await renderLoaded();
      fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Lerato" } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
      await screen.findByText("Profile saved");

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(screen.queryByText("Profile saved")).not.toBeInTheDocument();
    });

    it("opens and cancels the delete account dialog", async () => {
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
      const dialog = await screen.findByRole("dialog", { name: "Delete Account" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

      expect(screen.queryByRole("dialog", { name: "Delete Account" })).not.toBeInTheDocument();
    });

    it("deactivates the account, logs out and sends the user to the login page", async () => {
      routes["POST /api/accounts/me/deactivate"] = { body: { message: "Account deactivated successfully" } };
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
      const dialog = await screen.findByRole("dialog", { name: "Delete Account" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete Account" }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login?deleted=1"));
      expect(requestsTo("POST", "/api/auth/logout")).toHaveLength(1);
    });

    it("keeps the user signed in and explains why when deletion is refused", async () => {
      routes["POST /api/accounts/me/deactivate"] = {
        status: 409,
        body: { message: "The last active administrator cannot be removed. Make another user an administrator first." },
      };
      await renderLoaded();

      fireEvent.click(screen.getByRole("button", { name: "Delete Account" }));
      const dialog = await screen.findByRole("dialog", { name: "Delete Account" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete Account" }));

      expect(await screen.findByText(/The last active administrator cannot be removed/)).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
      expect(requestsTo("POST", "/api/auth/logout")).toHaveLength(0);
    });
  });

  describe("help and contact", () => {
    it("links to the help centre and the contact page", async () => {
      await renderLoaded();

      expect(screen.getByRole("link", { name: "View Help" })).toHaveAttribute("href", "/help");
      expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    });
  });
});