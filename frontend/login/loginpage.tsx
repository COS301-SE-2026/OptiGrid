import React, { useState } from "react";

 
interface LoginForm {
  email: string;
  password: string;
}
 
interface InputState {
  focused: boolean;
  hasValue: boolean;
}
 
const LoginPage: React.FC = () => {
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [inputStates, setInputStates] = useState<Record<string, InputState>>({
    email: { focused: false, hasValue: false },
    password: { focused: false, hasValue: false },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setInputStates((prev) => ({
      ...prev,
      [name]: { ...prev[name], hasValue: value.length > 0 },
    }));
    if (error) setError("");
  };

  const handleFocus = (name: string): void => {
    setInputStates((prev) => ({
      ...prev,
      [name]: { ...prev[name], focused: true },
    }));
  };




   const handleBlur = (name: string): void => {
    setInputStates((prev) => ({
      ...prev,
      [name]: { ...prev[name], focused: false },
    }));
  };




/*const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    setIsLoading(true);
    setError("");
    
    await new Promise((res) => setTimeout(res, 1800));
    setIsLoading(false);
    setError("Invalid credentials. Please try again.");
  };*/


};

export default LoginPage;