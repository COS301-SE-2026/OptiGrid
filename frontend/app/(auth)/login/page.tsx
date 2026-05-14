"use client";

import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { Card, Title, TextInput, Button } from "@tremor/react";
import Link from "next/link";
import {
    getLoginError,
    initialLoginFormData,
    type LoginFormData,
} from "./validation";

export default function LoginPage() {
    const [formData, setFormData] = useState<LoginFormData>(
        initialLoginFormData
    );

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

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();

        const errorMessage = getLoginError(formData);
        if (errorMessage) {
            setError(errorMessage);
            return;
        }

        setError("");
        setLoading(true);

        try {
            await new Promise((res) => setTimeout(res, 1500));

            console.log("Login data:", formData);
        } catch (err) {
            setError("Login failed. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md space-y-6 p-6">
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

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <Button className="w-full" type="submit" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </Button>
                </form>

                <p className="text-sm text-gray-600">
                    {"Don't"} have an account?{" "}
                    <Link
                        href="/signup"
                        className="text-blue-600 underline hover:text-blue-700"
                    >
                        Sign up
                    </Link>
                </p>
            </Card>
        </div>
    );
}