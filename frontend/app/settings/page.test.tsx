import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsPage from "./page";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockToggle = jest.fn();


let mockTheme = "light";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

jest.mock("../theme-provider", () => ({
  useTheme: () => ({ theme: mockTheme, toggle: mockToggle }),
}));

beforeAll(() => {
  
  jest.useFakeTimers();


});

afterAll(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();

   jest.spyOn(window, "confirm").mockReturnValue(true);

  

  
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

/*const getFirstNameInput = () => screen.getByPlaceholderText(/enter first name/i) as HTMLInputElement;
const getLastNameInput = () => screen.getByPlaceholderText(/enter last name/i) as HTMLInputElement;
const getEmailInput = () => screen.getByPlaceholderText(/enter email address/i) as HTMLInputElement;
const getDeleteConfirmInput = () => screen.getByPlaceholderText(/type delete here/i) as HTMLInputElement;
*/
describe("SettingsPage", () => {
  describe("Initial render", () => {
    it("renders the Settings heading", async () => {
      
        render(<SettingsPage />);
      
      expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument();
    });

    it("renders the subtitle", async () => {
      
        render(<SettingsPage/>);
      
      expect(screen.getByText(/manage your profile and account settings/i)).toBeInTheDocument();
    });

    it("renders the role badge", async () => {
      
        render(<SettingsPage />);
     
      expect(await screen.findByText("Admin")).toBeInTheDocument();
    });

    it("renders the Profile Information section", async () => {
      
        render(<SettingsPage />);
    
      expect(screen.getByRole("heading", { name: /profile information/i })).toBeInTheDocument();
    });

    it("renders the Theme section", async () => {
      
        render(<SettingsPage />);
     
      expect(screen.getByRole("heading", { name: /theme/i })).toBeInTheDocument();
    });

    it("renders the Help & Contact section", async () => {
      
        render(<SettingsPage />);
      
      expect(screen.getByRole("heading", { name: /help & contact/i })).toBeInTheDocument();
    });

    it("renders the Account Management section", async () => {
      
        render(<SettingsPage />);
  
      expect(screen.getByRole("heading", { name: /account management/i })).toBeInTheDocument();
    });

   /* it("pre-fills first name with 'Tali'", async () => {
      
        render(<SettingsPage />);
   
      expect(await screen.findByDisplayValue("Tali")).toBeInTheDocument();
    });

    it("pre-fills last name with 'Seaba'", async () => {
      
        render(<SettingsPage />);
     
      expect(await screen.findByDisplayValue("Seaba")).toBeInTheDocument();
    });

    it("pre-fills email with 'Tali@example.com'", async () => {
      
        render(<SettingsPage />);
     
      expect(await screen.findByDisplayValue("Tali@example.com")).toBeInTheDocument();
    });*/

it.each([
  "Tali",
  "Seaba",
  "Tali@example.com",
])("pre-fills %s", async (value) => {
  render(<SettingsPage />);
  expect(await screen.findByDisplayValue(value)).toBeInTheDocument();
});



    it("renders the Role input as disabled", async () => {
     
        render(<SettingsPage />);
    
      const roleInput = await screen.findByDisplayValue("Admin");
      expect(roleInput).toBeDisabled();
    });

    it("does not show toast on initial render", async () => {
     
        render(<SettingsPage />);
    
      expect(screen.queryByText(/profile changes saved/i)).not.toBeInTheDocument();
    });

    it("does not show delete modal on initial render", async () => {
      
        render(<SettingsPage />);
 
      expect(screen.queryByPlaceholderText(/type delete here/i)).not.toBeInTheDocument();
    });
  });

  describe("Profile field updates", () => {
    /*it("updates first name on change", async () => {
     
        render(<SettingsPage />);
   
      const input = await screen.findByDisplayValue("Tali");
   
        fireEvent.change(input, { target: { value: "John" } });

      expect(input).toHaveValue("John");
    });

    it("updates last name on change", async () => {
      
        render(<SettingsPage />);
    
      const input = await screen.findByDisplayValue("Seaba");
     
        fireEvent.change(input, { target: { value: "Doe" } });
    
      expect(input).toHaveValue("Doe");
    });

    it("updates email on change", async () => {
      
        render(<SettingsPage />);
  
      const input = await screen.findByDisplayValue("Tali@example.com");
     
        fireEvent.change(input, { target: { value: "new@example.com" } });
     
      expect(input).toHaveValue("new@example.com");
    });*/
    it.each([
  ["Tali", "John"],
  ["Seaba", "Doe"],
  ["Tali@example.com", "new@example.com"],
])("updates %s", async (initialValue, newValue) => {
  render(<SettingsPage />);

  const input = (await screen.findByDisplayValue(
    initialValue
  )) as HTMLInputElement;

  fireEvent.change(input, {
    target: { value: newValue },
  });

  expect(input).toHaveValue(newValue);
});

});

  describe("Save Changes button", () => {
    it("renders the Save Changes button", async () => {
      
        render(<SettingsPage />);
    
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("shows toast 'Profile changes saved' after clicking Save Changes", async () => {
     
        render(<SettingsPage />);
      
      await screen.findByDisplayValue("Tali");
     
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    
      expect(await screen.findByText(/profile changes saved/i)).toBeInTheDocument();
    });

    it("toast disappears after 3 seconds", async () => {
     
        render(<SettingsPage />);
   
      await screen.findByDisplayValue("Tali");
  
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
   
      expect(await screen.findByText(/profile changes saved/i)).toBeInTheDocument();
     
        jest.advanceTimersByTime(3000);
      await waitFor(() => {
      expect(screen.queryByText(/profile changes saved/i)).not.toBeInTheDocument();
      });
    });

    it("saves profile with updated first name", async () => {
    
        render(<SettingsPage />);
  
      const input = await screen.findByDisplayValue("Tali");
     
        fireEvent.change(input, { target: { value: "Updated" } });
        fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    
      expect(input).toHaveValue("Updated");
    });
  });

  describe("Reset button", () => {
   /* it("renders the Reset button", async () => {
      
        render(<SettingsPage />);
      
      expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    });

    it("resets first name to 'Tali'", async () => {
   
        render(<SettingsPage />);
     
      const input = await screen.findByDisplayValue("Tali");
    
        fireEvent.change(input, { target: { value: "Changed" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
      
      expect(input).toHaveValue("Tali");
    });

    it("resets last name to 'Seaba'", async () => {
   
        render(<SettingsPage />);
      
      const input = await screen.findByDisplayValue("Seaba");
     
        fireEvent.change(input, { target: { value: "Changed" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
     
      expect(input).toHaveValue("Seaba");
    });

    it("resets email to 'Tali@example.com'", async () => {
      
        render(<SettingsPage />);
   
      const input = await screen.findByDisplayValue("Tali@example.com");
     
        fireEvent.change(input, { target: { value: "changed@email.com" } });
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    
      expect(input).toHaveValue("Tali@example.com");
    });*/

    it.each([
  ["Tali", "Changed", "Tali"],
  ["Seaba", "Changed", "Seaba"],
  ["Tali@example.com", "changed@email.com", "Tali@example.com"],
])("resets %s", async (initialValue, changedValue, expectedValue) => {
  render(<SettingsPage />);

  const input = (await screen.findByDisplayValue(
    initialValue
  )) as HTMLInputElement;

  fireEvent.change(input, {
    target: { value: changedValue },
  });

  fireEvent.click(screen.getByRole("button", { name: /reset/i }));

  expect(input).toHaveValue(expectedValue);
});






    it("shows toast 'Profile reset'", async () => {
      
        render(<SettingsPage />);
   
      await screen.findByDisplayValue("Tali");
   
        fireEvent.click(screen.getByRole("button", { name: /reset/i }));
  
      expect(await screen.findByText(/profile reset/i)).toBeInTheDocument();
    });
  });

  describe("Theme toggle button", () => {
    it("renders the theme toggle button", async () => {
      
        render(<SettingsPage />);

      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("shows 'Light Mode' when theme is light", async () => {
     
        render(<SettingsPage />);
     
      expect(screen.getByText("Light Mode")).toBeInTheDocument();
    });

    it("shows 'Dark Mode' label when theme is dark", async () => {
      mockTheme = "dark";
     
        render(<SettingsPage />);
     
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
    });

    it("button label says 'Switch to Dark Mode' in light mode", async () => {
  
        render(<SettingsPage />);
    
      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("button label says 'Switch to Light Mode' in dark mode", async () => {
      mockTheme = "dark";
      
        render(<SettingsPage />);
      
      expect(screen.getByRole("button", { name: /switch to light mode/i })).toBeInTheDocument();
    });

    it("calls toggle when theme button is clicked", async () => {
    
        render(<SettingsPage />);
  
      await screen.findByDisplayValue("Tali");
    
        fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
    
      expect(mockToggle).toHaveBeenCalledTimes(1);
    });

    it("calls fetch to sync theme to backend", async () => {
     
        render(<SettingsPage />);
  
      await screen.findByDisplayValue("Tali");
      
        fireEvent.click(screen.getByRole("button", { name: /switch to dark mode/i }));
  
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/preferences/theme",
        expect.objectContaining({ method: "PUT" })
      );
    });
  });

  describe("Help & Contact links", () => {
    it("renders the View Help link pointing to /help", async () => {
 
        render(<SettingsPage />);
    
      const link = screen.getByRole("link", { name: /view help/i });
      expect(link).toHaveAttribute("href", "/help");
    });

    it("renders the Contact link pointing to /contact", async () => {
      
        render(<SettingsPage />);
     
      const link = screen.getByRole("link", { name: /^contact$/i });
      expect(link).toHaveAttribute("href", "/contact");
    });
  });

  describe("Logout button", () => {
    it("renders the Logout button", async () => {
     
        render(<SettingsPage />);
  
      expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    });

    it("calls window.confirm when Logout is clicked", async () => {
     
        render(<SettingsPage />);
      
     
        fireEvent.click(screen.getByRole("button", { name: /logout/i }));
     
      expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to logout?");
    });

    it("shows 'Logged out' toast after confirming logout", async () => {
      
        render(<SettingsPage />);
      
     
        fireEvent.click(screen.getByRole("button", { name: /logout/i }));
     
      expect(await screen.findByText(/logged out/i)).toBeInTheDocument();
    });

    it("clears the authenticated session when logout is confirmed", async () => {
        render(<SettingsPage />);

        fireEvent.click(screen.getByRole("button", { name: /logout/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/auth/logout",
          expect.objectContaining({ method: "POST" })
        );
      });
    });

    it("redirects to /login after logout", async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      await screen.findByText(/logged out/i);
      jest.advanceTimersByTime(500);

      expect(mockPush).toHaveBeenCalledWith("/login?loggedOut=1");
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("does not redirect when logout is cancelled", async () => {
      (window.confirm as jest.Mock).mockReturnValueOnce(false);
      render(<SettingsPage />);

      fireEvent.click(screen.getByRole("button", { name: /logout/i }));
      jest.advanceTimersByTime(500);

      expect(mockPush).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" })
      );
    });

    describe("Delete Account", () => {
  it("opens the Delete Account modal when clicked", () => {
    render(<SettingsPage />);

    const deleteButton = screen.getByRole("button", {
      name: /^Delete Account$/i,
    });

    fireEvent.click(deleteButton);

    expect(
      screen.getByRole("heading", {
        name: /Delete Account/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /All your data will be permanently deleted. This action cannot be undone/i
      )
    ).toBeInTheDocument();
  });

  it("closes the Delete Account modal when Cancel is clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Delete Account$/i,
      })
    );

    expect(
      screen.getByRole("heading", {
        name: /Delete Account/i,
      })
    ).toBeInTheDocument();

    const modal = screen.getByRole("dialog");

    fireEvent.click(
      within(modal).getByRole("button", {
        name: /^Cancel$/i,
      })
    );

    expect(
      screen.queryByRole("heading", {
        name: /Delete Account/i,
      })
    ).not.toBeInTheDocument();
  });
    });


    describe("Recover Account", () => {
  it("opens the Recover Account modal when clicked", () => {
    render(<SettingsPage />);

    const recoverButton = screen.getByRole("button", {
      name: /^Recover Account$/i,
    });

    fireEvent.click(recoverButton);

    expect(
      screen.getByRole("heading", {
        name: /Recover Account/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Are you sure you want to recover your account/i
      )
    ).toBeInTheDocument();
  });

  it("closes the Recover Account modal when Cancel is clicked", () => {
    render(<SettingsPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Recover Account$/i,
      })
    );

    expect(
      screen.getByRole("heading", {
        name: /Recover Account/i,
      })
    ).toBeInTheDocument();

    const modal = screen.getByRole("dialog");

    fireEvent.click(
      within(modal).getByRole("button", {
        name: /^Cancel$/i,
      })
    );

    expect(
      screen.queryByRole("heading", {
        name: /Recover Account/i,
      })
    ).not.toBeInTheDocument();
  });
});







 
 
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
      
        render(<SettingsPage />);
      
      expect(await screen.findByDisplayValue(sessionProfile.firstName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(sessionProfile.lastName)).toBeInTheDocument();
      expect(screen.getByDisplayValue(sessionProfile.email)).toBeInTheDocument();
      expect(screen.getByDisplayValue("Manager")).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/me", { cache: "no-store" });
    });

    it("resets edits to the loaded profile", async () => {
      mockSessionProfile();
    
        render(<SettingsPage />);
 
      const firstName = await screen.findByDisplayValue(sessionProfile.firstName) as HTMLInputElement;
   
        fireEvent.change(firstName, { target: { value: "Changed" } });
      
      expect(firstName).toHaveValue("Changed");
    
        fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));
     
      expect(firstName).toHaveValue(sessionProfile.firstName);
    });
  });
});
});
