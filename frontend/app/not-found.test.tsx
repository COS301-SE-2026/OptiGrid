import { render, screen } from "@testing-library/react";
import { cookies } from "next/headers";
import { parseSession } from "../lib/session";
import NotFound from "./not-found";

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("../lib/session", () => ({
    parseSession: jest.fn(),
    SESSION_COOKIE_NAME: "test-cookie",
}));

describe("NotFound", () => {
    beforeEach(() => {
        (cookies as jest.Mock).mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "session" }) });
    });

    it("sends people who are not signed in to the home page", async () => {
        (parseSession as jest.Mock).mockReturnValue(null);
        render(await NotFound());
        expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
        expect(screen.queryByRole("link", { name: "Go to the dashboard" })).not.toBeInTheDocument();
    });

    it("sends signed in people back to the dashboard", async () => {
        (parseSession as jest.Mock).mockReturnValue({ firstName: "Thandi", email: "thandi@example.com", roleType: "ADMIN" });
        render(await NotFound());
        expect(screen.getByRole("heading", { name: "We could not find that page" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Go to the dashboard" })).toHaveAttribute("href", "/dashboard");
        expect(screen.getByRole("link", { name: "Visit the Help Centre" })).toHaveAttribute("href", "/help");
    });
});