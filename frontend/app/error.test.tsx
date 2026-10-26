import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppError from "./error";

jest.mock("next/link");

describe("AppError", () => {
    beforeEach(() => {
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("explains the problem inside the public page frame", () => {
        render(<AppError error={new Error("boom")} reset={jest.fn()} />);

        expect(screen.getByRole("alert")).toHaveTextContent("This page did not load");
        expect(screen.getByRole("link", { name: "OptiGrid home" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "Contact us" })).toHaveAttribute("href", "/contact");
        expect(console.error).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    });

    it("tries the page again when asked to", async () => {
        const reset = jest.fn();
        render(<AppError error={new Error("boom")} reset={reset} />);

        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(reset).toHaveBeenCalledTimes(1);
    });
});