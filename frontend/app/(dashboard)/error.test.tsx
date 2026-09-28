import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardError from "./error";
import DashboardLoading from "./loading";

describe("DashboardError", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("explains the problem and offers a way to deal with it", () => {
        render(<DashboardError error={new Error("boom")} reset={jest.fn()} />);
        expect(screen.getByRole("heading", { name: "This page did not load" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
    });

    it("tries to load the page again when asked to", async () => {
        const reset = jest.fn();
        render(<DashboardError error={new Error("boom")} reset={reset} />);

        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(reset).toHaveBeenCalledTimes(1);
    });
});

describe("DashboardLoading", () => {
    it("tells the assistive technology that the page is loading", () => {
        render(<DashboardLoading />);
        expect(screen.getByRole("status")).toHaveTextContent("Loading page");
    });
});