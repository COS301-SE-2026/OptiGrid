import React from "react";
import { render, screen } from "@testing-library/react";
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


 
  
  describe("Initial render", () => {
    it("renders the Settings heading", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /^settings$/i })).toBeInTheDocument();
    });
 
    it("renders the subtitle", () => {
      render(<SettingsPage />);
      expect(screen.getByText(/manage your profile and account settings/i)).toBeInTheDocument();
    });

    it("renders the Profile Information", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /profile information/i })).toBeInTheDocument();
    });
 
    it("renders the Appearance", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /Theme/i })).toBeInTheDocument();
    });
 
    it("renders the Help & Contact section", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /help & contact/i })).toBeInTheDocument();
    });
 
    it("renders the Account Management", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("heading", { name: /account management/i })).toBeInTheDocument();
    });


    it("renders the Save Changes button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    it("renders the Reset to Default button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    });

    it("renders the theme toggle button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /switch to dark mode/i })).toBeInTheDocument();
    });

    it("renders the Logout button", () => {
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /logout/i })).toBeInTheDocument();
    });


  });