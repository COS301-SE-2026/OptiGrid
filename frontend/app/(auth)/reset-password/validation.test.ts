import { getNewPasswordError } from "./validation";

describe("getNewPasswordError", () => {
    it.each([
        ["asks for a password when it is empty", "", "", "Enter a new password."],
        ["needs at least 8 characters", "Ab1!", "Ab1!", "Password must be at least 8 characters."],
        ["follows the same rules as sign up", "password123", "password123", "Password must include uppercase, lowercase, number, and symbol."],
        ["checks the two passwords match", "Strong1!pass", "Strong1!pas", "Passwords do not match."],
        ["accepts a strong password which is matching", "Strong1!pass", "Strong1!pass", ""],
    ])("%s", (_name, password, confirmPassword, expected) => {
        expect(getNewPasswordError(password, confirmPassword)).toBe(expected);
    });
});