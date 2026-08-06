import { hasErrors, shouldShowError, getSubmitResult } from "./logic";
import { initialSignupFormData } from "./validation";

describe("Signup Logic  file unit tests", () => {
    it("should_return_success", () => {
        const data = { 
            firstName: "John", 
            lastName: "Doe", 
            email: "john@example.com", 
            password: "Password@123", 
            confirmPassword: "Password123!" 
        };
        //act
        const out = getSubmitResult(data);    
        //assert
        expect(out.status).toBe("success");
        expect(out.errors).toEqual({});
        expect(out.touched).toEqual({});
        expect(out.nextFormData).toEqual(initialSignupFormData);
    });

    //the follwoing have act and assert done in one statement
    it("should_return_true_if_errors_exists", () => {
        expect(hasErrors({ email: "Email is required" })).toBe(true);
    });

    it("returns false if there are no errors", () => {
        expect(hasErrors({})).toBe(false);
    });

    it("should_return_true_if_email_has_error", () => {
        expect(shouldShowError("email", { 
            email: "Error" 
        }, { 
            email: true 
        })).toBe(true);
    });
        
    it("should_return_false_if_has_error", () => {
        expect(shouldShowError("email", { 
            email: "Error" 
        }, { 
            email: false 
        })).toBe(false);
    });
        
    it("should_return_false_if_no_error_and_touched", () => {
        expect(shouldShowError("email", 
            {}, { 
                email: true 
            })).toBe(false);
    });
});
