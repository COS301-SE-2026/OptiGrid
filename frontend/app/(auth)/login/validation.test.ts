import { getLoginError, initialLoginFormData } from "./validation";

describe("Validarion tests for login page", () => {
    it("should_do_nothing_if_correct", () => {
        expect(getLoginError({ 
            email: "test@example.com", 
            password: "Password@123" 
        })).toBe("");
    });

    it("should_return__error_if_email_||_password__missing", () => {
        expect(getLoginError({ 
            email: "", 
            password: "Password@123" 
        })).toBe("Please fill in all fields");
    });

    it("should_return_error_if_both_fields_are_missing", () => {
        expect(getLoginError({ 
            email: "", 
            password: "" 
        })).toBe("Please fill in all fields");
    });
});
