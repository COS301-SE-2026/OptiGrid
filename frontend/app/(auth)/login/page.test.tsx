import { getLoginError, initialLoginFormData } from "./validation";

describe("login validation", () => {
    it("returns an error when both fields are empty", () => {
        const error = getLoginError(initialLoginFormData);
        expect(error).toBe("Please fill in all fields");
    });

    it("returns an error when email is missing", () => {
        const error = getLoginError({
            email: "",
            password: "secret123",
        });
        expect(error).toBe("Please fill in all fields");
    });

    it("returns an error when password is missing", () => {
        const error = getLoginError({
            email: "test@example.com",
            password: "",
        });
        expect(error).toBe("Please fill in all fields");
    });

    it("returns no error when both fields are provided", () => {
        const error = getLoginError({
            email: "test@example.com",
            password: "secret123",
        });
        expect(error).toBe("");
    });
});
