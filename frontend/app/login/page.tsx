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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (error) setError("");
    if (success) setSuccess("");
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
      
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || "Login failed. Try again.");
      }

      const firstName = payload?.user?.firstName as string | undefined;
      setSuccess(`Login successful${firstName ? `, ${firstName}` : ""}.`);
      setFormData({ email: "", password: "" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Try again.";
      setError(message);
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
          {success && <p className="text-green-600 text-sm">{success}</p>}

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        <p className="text-sm text-gray-600">
          {"Don't"} have an account?{" "}
          <Link
            href="/signup"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
