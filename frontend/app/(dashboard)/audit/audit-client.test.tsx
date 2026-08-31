import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuditClient from "./audit-client";

const mockUseInfiniteQuery = jest.fn();
const mockFetchNextPage = jest.fn();
jest.mock("@tanstack/react-query", () => ({
    useInfiniteQuery: (options: unknown) => mockUseInfiniteQuery(options),
}));

const logsData = [
    {
        log_id: "log-1",
        timestamp: "2026-08-24T09:15:00Z",
        action_type: "LOGIN",
        target_table: "users",
        service: "core",
        operation: null,
        severity: "info",
        user_id: "user-1",
        user_email: "amina@optigrid.test",
        ip_address: "196.25.1.4"
    },
    {
        log_id: "log-2",
        timestamp: "2026-08-24T08:02:00Z",
        action_type: "SYSTEM_FAILURE",
        target_table: "telemetry",
        service: "ingestion",
        operation: "write",
        severity: "critical",
        user_id: null,
        user_email: null,
        ip_address: null
    }
];

function prepareQuery(overrides: Record<string, unknown> = {}) {
    mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ items: logsData, nextCursor: null }] },
        isLoading: false,
        isError: false,
        error: null,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        ...overrides,
    });
}
function lastQueryKey() {
    return mockUseInfiniteQuery.mock.calls.at(-1)?.[0]?.queryKey;
}

describe("AuditClient", () => {
    beforeEach(() => {
        mockUseInfiniteQuery.mockReset();
        mockFetchNextPage.mockReset();
        prepareQuery();
    });

    it("renders the heading and the filters", () => {
        render(<AuditClient />);
        expect(screen.getByRole("heading", { name: /security and audit/i })).toBeInTheDocument();
        expect(screen.getByLabelText("Action")).toBeInTheDocument();
        expect(screen.getByLabelText("Page")).toBeInTheDocument();
        expect(screen.getByLabelText("Severity")).toBeInTheDocument();
        expect(screen.getByLabelText("From")).toBeInTheDocument();
        expect(screen.getByLabelText("To")).toBeInTheDocument();
    });

    it("lists the entries with their user and target", () => {
        render(<AuditClient />);
        const rows = screen.getAllByRole("row").slice(1);
        expect(rows).toHaveLength(2);

        expect(within(rows[0]).getByText("login")).toBeInTheDocument();
        expect(within(rows[0]).getByText("amina@optigrid.test")).toBeInTheDocument();
        expect(within(rows[0]).getByText("users")).toBeInTheDocument();
        expect(within(rows[1]).getByText("system failure")).toBeInTheDocument();
        expect(within(rows[1]).getByText("telemetry (write)")).toBeInTheDocument();
    });

    it("counts the entries that are showing", () => {
        render(<AuditClient />);
        expect(screen.getByText("2 entries")).toBeInTheDocument();
    });


    it("falls back to System when an entry has no user", () => {
        render(<AuditClient />);
        const rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[1]).getByText("System")).toBeInTheDocument();
    });

    it("gives a badges to each entry with its severity", () => {
        render(<AuditClient />);

        const rows = screen.getAllByRole("row").slice(1);
        expect(within(rows[0]).getByText("info")).toHaveClass("badge-default");
        expect(within(rows[1]).getByText("critical")).toHaveClass("badge-danger");
    });

    it("refetches when the action filter changes", async () => {
        render(<AuditClient />);
        const user = userEvent.setup();
        await user.selectOptions(screen.getByLabelText("Action"), "LOGIN");
        expect(lastQueryKey()).toEqual(["audit-logs", "LOGIN", "all", "all", "", ""]);
    });

    it("refetches when the page filter changes", async () => {
        render(<AuditClient />);
        const user = userEvent.setup();

        await user.selectOptions(screen.getByLabelText("Page"), "LIVE");

        expect(lastQueryKey()).toEqual(["audit-logs", "all", "LIVE", "all", "", ""]);
    });

    it("refetches when the severity and the dates change", async () => {
        render(<AuditClient />);
        const user = userEvent.setup();

        await user.selectOptions(screen.getByLabelText("Severity"), "error");
        await user.type(screen.getByLabelText("From"), "2026-08-01");

        expect(lastQueryKey()).toEqual(["audit-logs", "all", "all", "error", "2026-08-01", ""]);
    });

    it("clears every filter when reset is used", async () => {
        render(<AuditClient />);
        const user = userEvent.setup();

        await user.selectOptions(screen.getByLabelText("Action"), "DELETE");
        await user.selectOptions(screen.getByLabelText("Page"), "COMPARE");
        await user.click(screen.getByRole("button", { name: "Reset" }));
        expect(lastQueryKey()).toEqual(["audit-logs", "all", "all", "all", "", ""]);
    });

    it("loads the next page when requested", async () => {
        prepareQuery({ hasNextPage: true });
        render(<AuditClient />);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: "Load more" }));

        expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("shows an empty state when nothing matches", () => {
        prepareQuery({ data: { pages: [{ items: [], nextCursor: null }] } });
        render(<AuditClient />);
        expect(screen.getByText(/no activity matches these filters/i)).toBeInTheDocument();
    });

    it("hides the table while the logs are loading", () => {
        prepareQuery({ data: undefined, isLoading: true });
        render(<AuditClient />);
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows a load failure", () => {
        prepareQuery({ data: undefined, isError: true, error: new Error("Admin access required") });
        render(<AuditClient />);
        expect(screen.getByRole("alert")).toHaveTextContent("Admin access required");
    });
});
