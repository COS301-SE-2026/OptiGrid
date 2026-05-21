import { initialSignupFormData, validateSignup, type SignupFormData } from "./validation";

export type SignupErrors = Partial<Record<keyof SignupFormData, string>>;
export type SignupTouched = Partial<Record<keyof SignupFormData, boolean>>;
export type SignupStatus = "idle" | "success";

const allTouched: SignupTouched = {
    firstName: true,
    lastName: true,
    email: true,
    password: true,
    confirmPassword: true,
};

export function hasErrors(errors: SignupErrors): boolean {
    return Object.keys(errors).length > 0;
}

export function shouldShowError(field: keyof SignupFormData, errors: SignupErrors, touched: SignupTouched): boolean {
    return Boolean(errors[field] && touched[field]);
}

export type SubmitResult = {
    errors: SignupErrors;
    touched: SignupTouched;
    status: SignupStatus;
    nextFormData: SignupFormData;
};

export function getSubmitResult(formData: SignupFormData): SubmitResult {
    const nextErrors = validateSignup(formData);

    if (hasErrors(nextErrors)) {
        return {
            errors: nextErrors,
            touched: { ...allTouched },
            status: "idle",
            nextFormData: formData,
        };
    }

    return {
        errors: {},
        touched: {},
        status: "success",
        nextFormData: initialSignupFormData,
    };
}
