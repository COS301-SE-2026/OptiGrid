import { PublicNav } from "./PublicNav";
import { render, screen, waitFor } from "@testing-library/react";

jest.mock("next/link");

describe("PublicNav", () => {
    describe("signed out", () => {
        beforeEach(() => {
            render(<PublicNav signedIn={false} />);
        });

        it("renders the landing page navigation links", () => {
            const nav = screen.getByRole("navigation", { name: "Primary" });
            expect(nav).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Features" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Outcomes" })).toBeInTheDocument();
            expect(screen.getByRole("link", { name: "Brand" })).toBeInTheDocument();
        });
        it("renders the log in and signup actions", () => {

            expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
            expect(screen.getByRole("link", { name: "Get started free" })).toHaveAttribute("href", "/signup");
        });

        it("doesn't offer a route back to the dashboard", () => {
            expect(screen.queryByRole("link", { name: "Back to dashboard" })).toBeNull();
        });

        it("links the logo to the landing page", () => {
            expect(screen.getByRole("link", { name: "OptiGrid home" })).toHaveAttribute("href", "/");
        });
    });

    describe("signed in", () => {
        beforeEach(() => {
            render(<PublicNav signedIn />);
        });

        it("renders only the link back to the dashboard", () => {
            expect(screen.getByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
            expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
            expect(screen.queryByRole("link", { name: "Get started free" })).toBeNull();
        });

        it("hides the marketing navigation links", () => {
            expect(screen.queryByRole("navigation", { name: "Primary" })).toBeNull();
            expect(screen.queryByRole("link", { name: "Brand" })).toBeNull();
        });

        it("links the logo to the dashboard so the tab keeps its session", () => {
            expect(screen.getByRole("link", { name: "OptiGrid dashboard" })).toHaveAttribute("href", "/dashboard");
        });
    });

    describe("checking the tab session in the browser", () => {
        const originalFetch = global.fetch;

        afterEach(() => {
            global.fetch = originalFetch;
        });

        it("offers the dashboard once the tab turns out to be signed in", async () => {
            global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as unknown as typeof fetch;
            render(<PublicNav signedIn={false} detectSession />);

            expect(await screen.findByRole("link", { name: "Back to dashboard" })).toHaveAttribute("href", "/dashboard");
            expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
            expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
            expect(global.fetch).toHaveBeenCalledWith("/api/auth/session?probe=1", { cache: "no-store" });
        });

        it("keeps the log in links when the check cannot reach the server", async () => {
            global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
            render(<PublicNav signedIn={false} detectSession />);

            await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
            expect(screen.getByRole("link", { name: "Get started free" })).toBeInTheDocument();
        });

        it("keeps the log in links for a signed out tab", async () => {
            global.fetch = jest.fn().mockResolvedValue({ status: 204 }) as unknown as typeof fetch;
            render(<PublicNav signedIn={false} detectSession />);

            await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
            expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "Back to dashboard" })).toBeNull();
        });
    });

    it("keeps the section anchors on the current page when no prefix is given", () => {
        render(<PublicNav signedIn={false} anchorPrefix="" />);

        expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href","#features");
    });
});