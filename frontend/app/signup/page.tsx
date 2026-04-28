"use client";

import { useState, type ChangeEvent, type SyntheticEvent } from "react";
import { Title, Card, TextInput, Button } from "@tremor/react";
import Link from "next/link";

export default function RegistrationForm() {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });

    const [error, setError] = useState("");

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setError("");
        setLoading(true);

        try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            console.log(formData);
        }
        catch (error) {
            setError("Something went wrong")
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4">
            <Card className="w-full max-w-md p-6 space-y-6">
                <Title>Create Account</Title>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-4">
                        <TextInput name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
                        <TextInput name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
                    </div>
                    <TextInput name="email" type="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
                    <TextInput name="password" type="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
                    <TextInput name="confirmPassword" type="password" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} required />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <Button className="w-full" type="submit">
                        Create Account
                    </Button>
                </form>
                <p className="text-sm text-gray-600">
                    Already have an account?{" "}
                    <Link className="text-blue-600 hover:text-blue-700 underline" href="/login">
                        Log in
                    </Link>
                </p>
            </Card>
        </div>
    );
}