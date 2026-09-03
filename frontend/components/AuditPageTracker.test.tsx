import { render, waitFor } from "@testing-library/react";
import { AuditPageTracker } from "./AuditPageTracker";

let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
    usePathname: () => mockPathname,
}));

describe("AuditPageTracker", () => {
    beforeEach(() => {
        mockPathname = "/dashboard";
        global.fetch = jest.fn().mockResolvedValue({ ok: true }) as jest.Mock;
    });

    it("records the dashboard page once", async () => {
        const { rerender } = render(<AuditPageTracker />);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        expect(global.fetch).toHaveBeenCalledWith(
            "/api/audit-events/page-view",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ page: "DASHBOARD" }),
            }),
        );

        rerender(<AuditPageTracker />);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("records supported client-side navigation", async () => {
        const { rerender } = render(<AuditPageTracker />);
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

        mockPathname = "/compare";
        rerender(<AuditPageTracker />);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
        expect(global.fetch).toHaveBeenLastCalledWith(
            "/api/audit-events/page-view",
            expect.objectContaining({ body: JSON.stringify({ page: "COMPARE" }) }),
        );
    });

    it("records the dashboard when the tab session prefix is on the path", async () => {
        mockPathname = "/_sessions/6f1f2e5a-9b6c-4f0e-8a1d-2c3b4d5e6f70/dashboard";
        render(<AuditPageTracker />);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        expect(global.fetch).toHaveBeenCalledWith("/api/audit-events/page-view",
            expect.objectContaining({ body: JSON.stringify({ page: "DASHBOARD" }) }),
        );
    });

    it("records compare when the tab session prefix is on the path", async () => {
        mockPathname = "/_sessions/6f1f2e5a-9b6c-4f0e-8a1d-2c3b4d5e6f70/compare";
        render(<AuditPageTracker />);

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        expect(global.fetch).toHaveBeenCalledWith(
            "/api/audit-events/page-view",
            expect.objectContaining({ body: JSON.stringify({ page: "COMPARE" }) }),
        );
    });

    it("ignores pages outside the audit allowlist", () => {
        mockPathname = "/settings";
        render(<AuditPageTracker />);

        expect(global.fetch).not.toHaveBeenCalled();
    });
});
