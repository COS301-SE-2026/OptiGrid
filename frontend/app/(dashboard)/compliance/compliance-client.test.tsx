import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ComplianceClient from "./compliance-client";

const AUDIT_HEAD = "9f1c2e7a4b8d3f60a5c1e9b2d7f4a8c3e6b1d9f2a5c8e3b7d1f4a9c2e6b8d3f5";

function buildReport(overrides: Record<string, unknown> = {}) {
    return {
        standard: "ISO 50001:2018",
        report_type: "Energy management compliance summary",
        generated_at: "2026-09-14T10:00:00.000Z",
        period: { label: "August 2026", start: "2026-08-01T00:00:00.000Z", end: "2026-08-31T23:59:59.999Z", days: 31 },
        organisation: { buildings_in_scope: 1, total_floor_area_sqft: 1000, sites: [] },
        energy_performance: { total_usage_kwh: 5000, total_cost_zar: 12500, average_daily_kwh: 161.29, intensity_kwh_per_sqm: 53.8, source: "live_telemetry" },
        carbon_accounting: {
            total_kg_co2e: 0,
            ledger_entries: 0,
            expected_entries: 31,
            source_complete_entries: 0,
            source_incomplete_entries: 0,
            missing_entries: 31,
            scope_status: "INCOMPLETE",
            buildings: []
        },
        nonconformities: { total: 4, open: 2, resolved: 2, raised_in_period: 1, by_severity: { high: 3, low: 1 } },
        corrective_actions: {
            total: 5,
            implemented: 1,
            applying: 2,
            pending: 1,
            applied_monthly_saving_zar: 700.5,
            estimated_monthly_saving_zar: 1200
        },
        audit_trail: {
            entries_in_period: 12,
            total_chained_entries: 40,
            integrity: {
                verified: false,
                verification_status: "NOT_RUN",
                algorithm: "SHA-256",
                records_checked: 0,
                current_hash: AUDIT_HEAD,
                chain_updated_at: "2026-09-13T08:00:00.000Z",
                broken_at: null
            }
        },
        digital_signature: {
            algorithm: "SHA-256",
            value: AUDIT_HEAD,
            verified: false,
            records_covered: 40,
            source: "audit_log",
            signed_at: "2026-09-14T10:00:00.000Z"
        },
        ...overrides
    };
}

const mockFetch = jest.fn();

function respond(payload: unknown, ok = true) {
    return Promise.resolve({ ok, json: async () => payload });
}

function renderPage() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={client}>
            <ComplianceClient />
        </QueryClientProvider>
    );
}

beforeEach(() => {
    mockFetch.mockReset();
    (global as typeof globalThis).fetch = mockFetch as unknown as typeof fetch;
});

describe("ComplianceClient", () => {
    it("shows the anomaly register with the count for the report month", async () => {
        mockFetch.mockImplementation(() => respond({ data: buildReport() }));
        renderPage();

        expect(await screen.findByText("Raised in August 2026: 1")).toBeInTheDocument();
        expect(screen.getByText("All records to date")).toBeInTheDocument();
    });

    it("shows the signature before a check and asks for one", async () => {
        mockFetch.mockImplementation(() => respond({ data: buildReport() }));
        renderPage();

        expect(await screen.findByText(AUDIT_HEAD)).toBeInTheDocument();
        expect(screen.getByText(/Press Verify Data Integrity to confirm it/)).toBeInTheDocument();
    });

    it("counts the approved actions as applied and shows both savings", async () => {
        mockFetch.mockImplementation(() => respond({ data: buildReport() }));
        renderPage();

        expect(await screen.findByText("Saving applied per month")).toBeInTheDocument();
        expect(screen.getByText("Applied").nextElementSibling).toHaveTextContent("3");
        expect(screen.getByText("Saving applied per month").nextElementSibling).toHaveTextContent("R 700.50");
        expect(screen.getByText("Saving still available").nextElementSibling).toHaveTextContent("R 1,200.00");
    });

    it("reloads the report after a check and shows the new status of the ledger", async () => {
        const user = userEvent.setup();
        mockFetch.mockImplementation((url: string) => {
            if (url === "/api/compliance/verify") {
                return respond({
                    data: {
                        verified: true,
                        verification_status: "VERIFIED",
                        algorithm: "SHA-256",
                        records_checked: 40,
                        current_hash: AUDIT_HEAD,
                        chain_started_at: null,
                        chain_updated_at: "2026-09-13T08:00:00.000Z",
                        broken_at: null,
                        verified_at: "2026-09-14T10:01:00.000Z",
                        carbon_ledger: { month: "2026-08", scope_status: "VALID", buildings: [{ building_id: "b1", status: "VALID" }] }
                    }
                });
            }
            return respond({ data: buildReport() });
        });
        renderPage();

        expect(await screen.findByText("Ledger incomplete")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));

        expect(await screen.findByText("Ledger verified")).toBeInTheDocument();
        expect(screen.getByText("Chain verified")).toBeInTheDocument();
        expect(screen.getByText(/carbon ledger for August 2026 checked out and is now marked VALID/)).toBeInTheDocument();
        expect(screen.getByText(/Verified against the ledger/)).toBeInTheDocument();
        await waitFor(() => expect(mockFetch.mock.calls.filter(([url]) => url === "/api/compliance/report?format=json")).toHaveLength(2));
    });

    it("shows the server message when the report cannot load", async () => {
        mockFetch.mockImplementation(() => respond({ message: "No buildings found for user." }, false));
        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent("No buildings found for user.");
    });
});