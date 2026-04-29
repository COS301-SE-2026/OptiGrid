export type SignupFormData = {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
};

export const initialSignupFormData: SignupFormData = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(data: SignupFormData): Partial<Record<keyof SignupFormData, string>> {
    const errors: Partial<Record<keyof SignupFormData, string>> = {};

    if (!data.firstName.trim()) {
        errors.firstName = "First name is required.";
    }

    if (!data.lastName.trim()) {
        errors.lastName = "Last name is required.";
    }

    if (!data.email.trim()) {
        errors.email = "Email is required.";
    } else if (!emailPattern.test(data.email)) {
        errors.email = "Enter a valid email address.";
    }

    if (!data.password) {
        errors.password = "Password is required.";
    } else if (data.password.length < 8) {
        errors.password = "Password must be at least 8 characters.";
    }

    if (!data.confirmPassword) {
        errors.confirmPassword = "Confirm your password.";
    } else if (data.confirmPassword !== data.password) {
        errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
}
