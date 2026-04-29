import { getSubmitResult, hasErrors, shouldShowError } from "./logic";
import { initialSignupFormData } from "./validation";

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
            password: "PassWord#1*",
            confirmPassword: "PassWord#1"
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
