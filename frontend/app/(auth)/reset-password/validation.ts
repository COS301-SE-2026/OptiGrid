import { passwordPattern } from "../signup/validation";

export function getNewPasswordError(password: string, confirmPassword: string): string {
    if (!password) {
        return "Enter a new password.";
    }
    if (password.length < 8) {
        return "Password must be at least 8 characters.";
    }
    if (!passwordPattern.test(password)) {
        return "Password must include uppercase, lowercase, number, and symbol.";
    }
    if (password !== confirmPassword) {
        return "Passwords do not match.";
    }
    return "";
}