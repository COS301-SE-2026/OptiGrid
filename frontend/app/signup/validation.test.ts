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
            firstName: "Avery",
            lastName: "Rivera",
            email: "avery-at-optigrid",
            password: "SecurePass1",
            confirmPassword: "SecurePass1",
        });
        expect(errors.email).toBe("Enter a valid email address.");
    });

    it("enforces minimum password length", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Avery",
            lastName: "Rivera",
            email: "avery.rivera@optigrid.io",
            password: "short",
            confirmPassword: "short",
        });
        expect(errors.password).toBe("Password must be at least 8 characters.");
    });

    it("rejects mismatched confirmation", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Avery",
            lastName: "Rivera",
            email: "avery.rivera@optigrid.io",
            password: "SecurePass1",
            confirmPassword: "SecurePass2",
        });
        expect(errors.confirmPassword).toBe("Passwords do not match.");
    });

    it("accepts valid input", () => {
        const errors = validateSignup({
            ...initialSignupFormData,
            firstName: "Avery",
            lastName: "Rivera",
            email: "avery.rivera@optigrid.io",
            password: "SecurePass1",
            confirmPassword: "SecurePass1",
        });
        expect(Object.keys(errors)).toHaveLength(0);
    });
});
