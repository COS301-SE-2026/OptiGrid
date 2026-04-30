"use client";

import { useState, useEffect } from "react";

export default function ThemeTogglePage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);


  if (theme === null){
    return null;
  }

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 text-black dark:text-white transition-colors">
      <h1 className="text-2xl mb-6">Theme</h1>

      <button
        onClick={toggleTheme}
        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
      >
        Switch to {theme === "light" ? "Dark" : "Light"} Mode
      </button>

      <p className="mt-4">
        Current theme: <strong>{theme}</strong>
      </p>
    </div>
  );
}