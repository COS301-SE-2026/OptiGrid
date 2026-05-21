"use client";

import { useEffect, useState, type ChangeEvent, type SyntheticEvent } from "react";
import { Card, Title, TextInput, Button } from "@tremor/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    getLoginError,
    initialLoginFormData,
    type LoginFormData,
} from "./validation";

export default function LoginPage() {
    const router = useRouter();
    const [isClientReady, setIsClientReady] = useState(false);
    const [formData, setFormData] = useState<LoginFormData>(
        initialLoginFormData
    );

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIsClientReady(true);

        const query = new URLSearchParams(window.location.search);
        const signupState = query.get("signup");
        const loggedOut = query.get("loggedOut");
        const emailFromQuery = query.get("email");

        if (signupState === "success") {
            setSuccess("Account created successfully. Please log in.");
        } else if (loggedOut === "1") {
            setSuccess("You have been logged out.");
        }

        if (emailFromQuery) {
            setFormData((previous) => ({
                ...previous,
                email: previous.email || emailFromQuery,
            }));
        }
    }, []);

    if (!isClientReady) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
                <Card className="w-full max-w-md space-y-6 p-6">
                    <Title>Login</Title>
                    <p className="text-sm text-gray-600">Preparing sign-in form...</p>
                </Card>
            </div>
        );
    }

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        if (error) setError("");
        if (success) setSuccess("");
    };

    const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault();

        const errorMessage = getLoginError(formData);
        if (errorMessage) {
            setError(errorMessage);
            return;
        }

        setError("");
        setSuccess("");
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
            setFormData(initialLoginFormData);
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Login failed. Try again.";
            setError(message);
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
                    {success && <p className="text-sm text-green-600">{success}</p>}

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
