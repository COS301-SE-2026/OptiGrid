import { getNewPasswordError } from "./validation";

describe("getNewPasswordError", () => {
    it("asks for a password when it is empty", () => {
        expect(getNewPasswordError("", "")).toBe("Enter a new password.");
    });

    it("needs at least 8 characters", () => {
        expect(getNewPasswordError("Ab1!", "Ab1!")).toBe("Password must be at least 8 characters.");
    });

    it("follows the same rules as sign up", () => {
        expect(getNewPasswordError("password123", "password123")).toBe("Password must include uppercase, lowercase, number, and symbol.");
    });

    it("checks the two passwords match", () => {
        expect(getNewPasswordError("Strong1!pass", "Strong1!pas")).toBe("Passwords do not match.");
    });

    it("accepts a strong password which is matching", () => {
        expect(getNewPasswordError("Strong1!pass", "Strong1!pass")).toBe("");
    });
});