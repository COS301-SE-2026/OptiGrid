import { initialSignupFormData, validateSignup } from "./validation";

describe("validateSignup", () => {
    it("requires all fields", () => {
        const errors = validateSignup(initialSignupFormData);
        expect(errors.firstName).toBe("First name is required.");
        expect(errors.lastName).toBe("Last name is required.");
        expect(errors.email).toBe("Email is required.");
        expect(errors.password).toBe("Password is required.");
        expect(errors.confirmPassword).toBe("Confirm your password.");
    });

    it("validates email format", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Abdelrahman",
            lastName: "Esam",
            email: "abdelrahman-at-optigrid",
            password: "PassWord#1",
            confirmPassword: "PassWord#1",
        });
        expect(errors.email).toBe("Enter a valid email address.");
    });

    it("enforces minimum password length", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Abdelrahman",
            lastName: "Esam",
            email: "abdelrahman.esam@optigrid.io",
            password: "short",
            confirmPassword: "short",
        });
        expect(errors.password).toBe("Password must be at least 8 characters.");
    });

    it("requires uppercase, lowercase, number, and symbol", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Abdelrahman",
            lastName: "Esam",
            email: "abdelrahman.esam@optigrid.io",
            password: "password12",
            confirmPassword: "password12",
        });
        expect(errors.password).toBe(
            "Password must include uppercase, lowercase, number, and symbol."
        );
    });

    it("rejects mismatched confirmation", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Abdelrahman",
            lastName: "Esam",
            email: "abdelrahman.esam@optigrid.io",
            password: "PassWord#1",
            confirmPassword: "PassWord#2",
        });
        expect(errors.confirmPassword).toBe("Passwords do not match.");
    });

    it("accepts valid input", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Abdelrahman",
            lastName: "Esam",
            email: "abdelrahman.esam@optigrid.io",
            password: "PassWord#1",
            confirmPassword: "PassWord#1",
        });
        expect(Object.keys(errors)).toHaveLength(0);
    });
});
