 import React, { useState } from "react";
import styles from "./loginpage.module.css";
 
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