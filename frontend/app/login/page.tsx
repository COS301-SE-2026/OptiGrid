"use client";

import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { Card, Title, TextInput, Button } from "@tremor/react";
import Link from "next/link";


export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
  };
//form validation

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      
      await new Promise((res) => setTimeout(res, 1500));

    } catch (err) {
      setError("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md p-6 space-y-6">
        <Title>Login</Title>

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            name="email"
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <TextInput
            name="password"
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="text-sm text-gray-600">
          {"Don't"} have an account?{" "}
          <Link
            href="/register"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}