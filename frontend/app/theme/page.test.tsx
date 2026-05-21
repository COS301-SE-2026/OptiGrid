import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ThemeTogglePage from "./page";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
  // Reset <html> classes between tests
  document.documentElement.className = "";
});

describe("ThemeTogglePage", () => {
  describe("Initial render", () => {
    it("renders the page heading", () => {
      render(<ThemeTogglePage />);
      expect(screen.getByRole("heading", { name: /theme/i })).toBeInTheDocument();
    });

    it("defaults to light theme when localStorage is empty", () => {
      render(<ThemeTogglePage />);
      expect(screen.getByText(/current theme:/i)).toBeInTheDocument();
      expect(screen.getByRole("strong" as any) ?? screen.getByText("light")).toBeInTheDocument();
      expect(screen.getByRole("button")).toHaveTextContent(/switch to dark mode/i);
    });

    it("does not add 'dark' class to <html> when no saved theme", () => {
      render(<ThemeTogglePage />);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("Persisted theme from localStorage", () => {
    it("restores dark theme saved in localStorage", () => {
      localStorageMock.getItem.mockReturnValueOnce("dark");
      render(<ThemeTogglePage />);
      expect(screen.getByRole("button")).toHaveTextContent(/switch to light mode/i);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("restores light theme saved in localStorage", () => {
      localStorageMock.getItem.mockReturnValueOnce("light");
      render(<ThemeTogglePage />);
      expect(screen.getByRole("button")).toHaveTextContent(/switch to dark mode/i);
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("Toggle button", () => {
    it("switches from light to dark on first click", () => {
      render(<ThemeTogglePage />);
      const button = screen.getByRole("button");

      fireEvent.click(button);

      expect(button).toHaveTextContent(/switch to light mode/i);
      expect(screen.getByText("dark")).toBeInTheDocument();
    });

    it("switches from dark back to light on second click", () => {
      render(<ThemeTogglePage />);
      const button = screen.getByRole("button");

      fireEvent.click(button); 
      fireEvent.click(button); 

      expect(button).toHaveTextContent(/switch to dark mode/i);
      expect(screen.getByText("light")).toBeInTheDocument();
    });

    it("adds 'dark' class to <html> when switching to dark", () => {
      render(<ThemeTogglePage />);
      fireEvent.click(screen.getByRole("button"));
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes 'dark' class from <html> when switching back to light", () => {
      document.documentElement.classList.add("dark");
      localStorageMock.getItem.mockReturnValueOnce("dark");
      render(<ThemeTogglePage />);

      fireEvent.click(screen.getByRole("button")); 

      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("localStorage persistence", () => {
    it("persists 'dark' to localStorage after toggling to dark", () => {
      render(<ThemeTogglePage />);
      fireEvent.click(screen.getByRole("button"));
      expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "dark");
    });

    it("persists 'light' to localStorage after toggling back to light", () => {
      localStorageMock.getItem.mockReturnValueOnce("dark");
      render(<ThemeTogglePage />);
      fireEvent.click(screen.getByRole("button")); 
      expect(localStorageMock.setItem).toHaveBeenCalledWith("theme", "light");
    });

    it("reads from localStorage on mount", () => {
      render(<ThemeTogglePage />);
      expect(localStorageMock.getItem).toHaveBeenCalledWith("theme");
    });
  });

  describe("Accessibility & UI", () => {
    it("renders exactly one button", () => {
      render(<ThemeTogglePage />);
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("displays current theme name in bold", () => {
      render(<ThemeTogglePage />);
      const strong = document.querySelector("strong");
      expect(strong).toBeInTheDocument();
      expect(strong?.textContent).toBe("light");
    });

    it("button label updates correctly after multiple toggles", () => {
      render(<ThemeTogglePage />);
      const button = screen.getByRole("button");

      expect(button).toHaveTextContent(/dark mode/i);
      fireEvent.click(button);
      expect(button).toHaveTextContent(/light mode/i);
      fireEvent.click(button);
      expect(button).toHaveTextContent(/dark mode/i);
    });
  });
});
