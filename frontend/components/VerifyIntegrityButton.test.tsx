import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerifyIntegrityButton, { IntegrityStatus, useIntegrityVerification } from "./VerifyIntegrityButton";

const mockFetch = jest.fn();

beforeEach(() => {
    mockFetch.mockReset();
    (global as typeof globalThis).fetch = mockFetch as unknown as typeof fetch;
});

const CHAIN_HEAD = "a2f5b8c1d4e7093a6b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1a";

function respondUsing(payload: unknown, ok = true) {
    mockFetch.mockResolvedValue({
        ok,
        json: async () => payload
    });
}

function verifiedPayload(overrides: Record<string, unknown> = {}) {
    return {
        status: "success",
        data: {
            verified: true,
            algorithm: "SHA-256",
            records_checked: 1284,
            current_hash: CHAIN_HEAD,
            chain_started_at: "2026-08-01T00:00:00.000Z",
            chain_updated_at: "2026-09-13T08:00:00.000Z",
            broken_at: null,
            verified_at: "2026-09-13T09:00:00.000Z",
            ...overrides
        }
    };
}

function VerifyPanel({ showSignature = true, variant }: Readonly<{ showSignature?: boolean; variant?: "primary" | "secondary" }>) {
    const { state, run } = useIntegrityVerification();
    return (
        <>
            <VerifyIntegrityButton state={state} onVerify={run} variant={variant} />
            <IntegrityStatus state={state} showSignature={showSignature} />
        </>
    );
}

describe("VerifyIntegrityButton", () => {
    it("shows no verdict before a user asks for one", () => {
        render(<VerifyPanel />);
        expect(screen.getByRole("button", { name: "Verify Data Integrity" })).toBeInTheDocument();
        expect(screen.queryByText(/Data Cryptographically Verified/)).not.toBeInTheDocument();
    });

    it("calls the verification endpoint when it is clicked", async () => {
        const user = userEvent.setup();
        respondUsing(verifiedPayload());
        render(<VerifyPanel />);
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
        expect(mockFetch).toHaveBeenCalledWith("/api/compliance/verify", expect.objectContaining({
            method: "GET",
            credentials: "include"
        }));
    });

    it("uses the algorithm that signed it to confirm an unbroken chain", async () => {
        const user = userEvent.setup();
        respondUsing(verifiedPayload());
        render(<VerifyPanel />);
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));
        expect(await screen.findByText("Data Cryptographically Verified (SHA-256)")).toBeInTheDocument();
        expect(screen.getByText(/1,284 ledger entries checked/)).toBeInTheDocument();
        expect(screen.getByText(CHAIN_HEAD)).toBeInTheDocument();
    });

    it("reports a broken chain instead of just a pass", async () => {
        const user = userEvent.setup();
        respondUsing(verifiedPayload({
            verified: false,
            records_checked: 42,
            broken_at: {
                log_id: "00000000-0000-4000-8000-000000000002",
                chain_index: "42",
                timestamp: "2026-09-12T10:00:00.000Z",
                reason: "content_mismatch"
            }
        }));
        render(<VerifyPanel />);
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));

        expect(await screen.findByText("Integrity check failed")).toBeInTheDocument();
        expect(screen.getByText(/an entry was edited after it was written/)).toBeInTheDocument();
        expect(screen.queryByText(/Data Cryptographically Verified/)).not.toBeInTheDocument();
    });

    it("hides the signature when the caller asks for the compact form", async () => {
        const user = userEvent.setup();
        respondUsing(verifiedPayload());
        render(<VerifyPanel showSignature={false} />);
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));
        expect(await screen.findByText("Data Cryptographically Verified (SHA-256)")).toBeInTheDocument();
        expect(screen.queryByText(CHAIN_HEAD)).not.toBeInTheDocument();
    });

    it("shows the server message when verification cannot run", async () => {
        const user = userEvent.setup();
        respondUsing({ message: "Unable to reach the compliance service." }, false);
        render(<VerifyPanel />);
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reach the compliance service.");
    });

    it("blocks a second run while a run is already in process", async () => {
        const user = userEvent.setup();
        mockFetch.mockImplementation(() => new Promise(() => undefined));
        render(<VerifyPanel />);
        await user.click(screen.getByRole("button", { name: "Verify Data Integrity" }));
        const button = screen.getByRole("button", { name: "Verifying..." });
        expect(button).toBeDisabled();
    });

    it("matches the filled header buttons when asked for the primary style", () => {
        render(<VerifyPanel variant="primary" />);
        const button = screen.getByRole("button", { name: "Verify Data Integrity" });
        expect(button).toHaveClass("btn-primary");
        expect(button).not.toHaveAttribute("style");
    });

    it("keeps the outlined style by default", () => {
        render(<VerifyPanel />);
        expect(screen.getByRole("button", { name: "Verify Data Integrity" })).toHaveClass("btn-secondary");
    });

    it("renders the redion of result where the page places it", () => {
        render(<IntegrityStatus state={{ phase: "idle" }} className="integrity-output-banner" />);
        const region = screen.getByRole("status");
        expect(region).toHaveClass("integrity-output", "integrity-output-banner");
        expect(region).toBeEmptyDOMElement();
    });
});