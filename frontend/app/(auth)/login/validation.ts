export type LoginFormData = {
    email: string;
    password: string;
};

export const initialLoginFormData: LoginFormData = {
    email: "",
    password: "",
};

export function getLoginError(data: LoginFormData): string {
    if (!data.email || !data.password) {
        return "Please fill in all fields";
    }
    return "";
}
