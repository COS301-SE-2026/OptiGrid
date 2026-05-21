import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "./page";
import { getSubmitResult, hasErrors, shouldShowError } from "./logic";
import { initialSignupFormData } from "./validation";

const mockPush = jest.fn();
const mockFetch = jest.fn();

jest.mock("next/link", () => {
    return function MockLink({
        href,
        children,
        ...rest
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) {
        return (
            <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
                {children}
            </a>
        );
    };
});

jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

beforeEach(() => {
    mockPush.mockReset();
    mockFetch.mockReset();
    (global as typeof globalThis).fetch = mockFetch as unknown as typeof fetch;
});

const validForm = {
    firstName: "Abdelrahman",
    lastName: "Esam",
    email: "abdelrahman.esam@optigrid.io",
    password: "PassWord#1",
    confirmPassword: "PassWord#1",
};

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("First name"), validForm.firstName);
    await user.type(screen.getByLabelText("Last name"), validForm.lastName);
    await user.type(screen.getByLabelText("Work email"), validForm.email);
    await user.type(screen.getByLabelText("Password"), validForm.password);
    await user.type(
        screen.getByLabelText("Confirm password"),
        validForm.confirmPassword
    );
}

describe("SignupPage UI", () => {
    it("renders the headline and login link", () => {
        render(<SignupPage />);
        expect(
            screen.getByRole("heading", { name: "Create your account" })
        ).toBeInTheDocument();
        const loginLink = screen.getByRole("link", { name: "Log in" });
        expect(loginLink).toHaveAttribute("href", "/login");
    });

    it("renders all input fields", () => {
        render(<SignupPage />);
        expect(screen.getByLabelText("First name")).toBeInTheDocument();
        expect(screen.getByLabelText("Last name")).toBeInTheDocument();
        expect(screen.getByLabelText("Work email")).toBeInTheDocument();
        expect(screen.getByLabelText("Password")).toBeInTheDocument();
        expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    });

    it("shows validation errors when submitting empty form", async () => {
        render(<SignupPage />);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "Create account" }));

        expect(screen.getByText("First name is required.")).toBeInTheDocument();
        expect(screen.getByText("Last name is required.")).toBeInTheDocument();
        expect(screen.getByText("Email is required.")).toBeInTheDocument();
        expect(screen.getByText("Password is required.")).toBeInTheDocument();
        expect(screen.getByText("Confirm your password.")).toBeInTheDocument();
    });

    it("submits valid data and navigates to dashboard", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({}),
        });

        render(<SignupPage />);
        const user = userEvent.setup();
        await fillForm(user);

        await user.click(screen.getByRole("button", { name: "Create account" }));

        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith("/dashboard");
        });

        const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
        const body = JSON.parse(options.body as string);
        expect(body).toEqual({
            firstName: validForm.firstName,
            lastName: validForm.lastName,
            email: validForm.email,
            password: validForm.password,
        });
    });

    it("shows API error and does not navigate on failure", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Email already exists." }),
        });

        render(<SignupPage />);
        const user = userEvent.setup();
        await fillForm(user);

        await user.click(screen.getByRole("button", { name: "Create account" }));

        expect(
            await screen.findByText("Email already exists.")
        ).toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("clears API error on input change", async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            json: async () => ({ message: "Registration failed." }),
        });

        render(<SignupPage />);
        const user = userEvent.setup();
        await fillForm(user);

        await user.click(screen.getByRole("button", { name: "Create account" }));

        expect(
            await screen.findByText("Registration failed.")
        ).toBeInTheDocument();

        await user.type(screen.getByLabelText("Work email"), "x");
        expect(
            screen.queryByText("Registration failed.")
        ).not.toBeInTheDocument();
    });
});

describe("signup page logic", () => {
    it("returns validation errors and marks the fields as touched for invalid input", () => {
        const result = getSubmitResult(initialSignupFormData);
        expect(result.status).toBe("idle");
        expect(result.errors.firstName).toBe("First name is required.");
        expect(result.errors.email).toBe("Email is required.");
        expect(result.touched.firstName).toBe(true);
        expect(result.touched.email).toBe(true);
    });

    it("returns success and resets data for valid input", () => {
        const result = getSubmitResult({
            ...initialSignupFormData,
            firstName: "Abdelrahman",
            lastName: "Esam",
            email: "abdelrahman.esam@optigrid.io",
            password: "PassWord#1",
            confirmPassword: "PassWord#1",
        });
        expect(result.status).toBe("success");
        expect(result.errors).toEqual({});
        expect(result.touched).toEqual({});
        expect(result.nextFormData).toEqual(initialSignupFormData);
    });

    it("shows field errors only when touched", () => {
        const errors = { email: "Email is required." };
        const touched = { email: true };
        expect(shouldShowError("email", errors, touched)).toBe(true);
        expect(shouldShowError("email", errors, {})).toBe(false);
    });

    it("detects when any errors are present", () => {
        expect(hasErrors({})).toBe(false);
        expect(hasErrors({ password: "Password is required." })).toBe(true);
    });
});