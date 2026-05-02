import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import LoginPage from "../../../frontend/app/login/page";


jest.mock("@tremor/react", () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  Title: ({ children }: any) => <h1>{children}</h1>,
  TextInput: ({ name, type, placeholder, value, onChange, required }: any) => (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      data-testid={`input-${name}`}
    />
  ),
  Button: ({ children, type, disabled, className }: any) => (
    <button type={type} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));


jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));



const fillEmail = (value: string) =>
  fireEvent.change(screen.getByTestId("input-email"), { target: { name: "email", value } });

const fillPassword = (value: string) =>
  fireEvent.change(screen.getByTestId("input-password"), { target: { name: "password", value } });

const submitForm = () =>
  fireEvent.submit(screen.getByRole("button", { name: /login/i }).closest("form")!);



describe("LoginPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  

  describe("Initial render", () => {
    it("renders the Login heading", () => {
      render(<LoginPage />);
      expect(screen.getByRole("heading", { name: /login/i })).toBeInTheDocument();
    });

    it("renders the email input", () => {
      render(<LoginPage />);
      expect(screen.getByTestId("input-email")).toBeInTheDocument();
    });

    it("renders the password input", () => {
      render(<LoginPage />);
      expect(screen.getByTestId("input-password")).toBeInTheDocument();
    });

    it("renders the submit button with 'Login' label", () => {
      render(<LoginPage />);
      expect(screen.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
    });

    it("submit button is enabled initially", () => {
      render(<LoginPage />);
      expect(screen.getByRole("button", { name: /^login$/i })).not.toBeDisabled();
    });

    it("renders the sign-up link pointing to /register", () => {
      render(<LoginPage />);
      const link = screen.getByRole("link", { name: /sign up/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/register");
    });

    it("does not show an error message on initial render", () => {
      render(<LoginPage />);
      expect(screen.queryByText(/please fill in all fields/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/login failed/i)).not.toBeInTheDocument();
    });
  });


  describe("Form inputs", () => {
    it("updates email field on change", () => {
      render(<LoginPage />);
      fillEmail("test@example.com");
      expect(screen.getByTestId("input-email")).toHaveValue("test@example.com");
    });

    it("updates password field on change", () => {
      render(<LoginPage />);
      fillPassword("secret123");
      expect(screen.getByTestId("input-password")).toHaveValue("secret123");
    });

    it("clears error when user starts typing after an error", () => {
      render(<LoginPage />);
      submitForm(); // triggers empty-field error
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();

      fillEmail("a@b.com");
      expect(screen.queryByText(/please fill in all fields/i)).not.toBeInTheDocument();
    });
  });



  describe("Validation", () => {
    it("shows error when both fields are empty on submit", () => {
      render(<LoginPage />);
      submitForm();
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });

    it("shows error when only email is filled", () => {
      render(<LoginPage />);
      fillEmail("test@example.com");
      submitForm();
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });

    it("shows error when only password is filled", () => {
      render(<LoginPage />);
      fillPassword("secret123");
      submitForm();
      expect(screen.getByText(/please fill in all fields/i)).toBeInTheDocument();
    });

    it("does not show validation error when both fields are filled", async () => {
      render(<LoginPage />);
      fillEmail("test@example.com");
      fillPassword("secret123");

      await act(async () => {
        submitForm();
      });

      expect(screen.queryByText(/please fill in all fields/i)).not.toBeInTheDocument();
    });
  });

 

  describe("Loading state", () => {
    it("shows 'Logging in...' while the request is pending", async () => {
      render(<LoginPage />);
      fillEmail("test@example.com");
      fillPassword("secret123");

      await act(async () => {
        submitForm();
      });

      expect(screen.getByRole("button", { name: /logging in/i })).toBeInTheDocument();
    });

    it("disables the submit button while loading", async () => {
      render(<LoginPage />);
      fillEmail("test@example.com");
      fillPassword("secret123");

      await act(async () => {
        submitForm();
      });

      expect(screen.getByRole("button", { name: /logging in/i })).toBeDisabled();
    });

    it("re-enables the button and restores label after loading completes", async () => {
      render(<LoginPage />);
      fillEmail("test@example.com");
      fillPassword("secret123");

      await act(async () => {
        submitForm();
      });

      // Advance past the 1500ms fake timeout
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      expect(screen.getByRole("button", { name: /^login$/i })).not.toBeDisabled();
    });
  });

 

  describe("Accessibility & UI", () => {
    it("password input has type='password'", () => {
      render(<LoginPage />);
      expect(screen.getByTestId("input-password")).toHaveAttribute("type", "password");
    });

    it("email input has type='email'", () => {
      render(<LoginPage />);
      expect(screen.getByTestId("input-email")).toHaveAttribute("type", "email");
    });

    it("renders exactly one submit button", () => {
      render(<LoginPage />);
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("renders the 'Don't have an account?' prompt", () => {
      render(<LoginPage />);
      expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
    });
  });
});