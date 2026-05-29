import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { FAQAccordion } from "./accordion";
import type { FAQCategory } from "./data";

const fixture: FAQCategory[] = [
    {
        category: "General",
        items: [
            { question: "What is OptiGrid?", answer: "An energy intelligence platform." },
            { question: "Is OptiGrid free?", answer: "There is a free trial available." },
        ],
    },
    {
        category: "Billing",
        items: [
            { question: "How do I cancel?", answer: "Contact support to cancel." },
        ],
    },
];

describe("FAQAccordion", () => {
    it("renders all category headings", () => {
        render(<FAQAccordion category={fixture} />);
        expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Billing" })).toBeInTheDocument();
    });

    it("renders all questions as buttons", () => {
        render(<FAQAccordion category={fixture} />);
        expect(screen.getByRole("button", { name: /What is OptiGrid/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Is OptiGrid free/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /How do I cancel/ })).toBeInTheDocument();
    });

    it("shows no answers on the initial render", () => {
        render(<FAQAccordion category={fixture} />);
        expect(screen.queryByText("An energy intelligence platform.")).not.toBeInTheDocument();
        expect(screen.queryByText("There is a free trial available.")).not.toBeInTheDocument();
        expect(screen.queryByText("Contact support to cancel.")).not.toBeInTheDocument();
    });

    it("all buttons start with aria-expanded set to false", () => {
        render(<FAQAccordion category={fixture} />);
        const buttons = screen.getAllByRole("button");
        for (const button of buttons) {
            expect(button).toHaveAttribute("aria-expanded", "false");
        }
    });

    it("clicking a question reveals its answer", async () => {
        render(<FAQAccordion category={fixture} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: /What is OptiGrid/ }));
        expect(screen.getByText("An energy intelligence platform.")).toBeInTheDocument();
    });

    it("clicking an open question hides its answer", async () => {
        render(<FAQAccordion category={fixture} />);
        const user = userEvent.setup();
        const button = screen.getByRole("button", { name: /What is OptiGrid/ });

        await user.click(button);
        expect(screen.getByText("An energy intelligence platform.")).toBeInTheDocument();
        await user.click(button);
        expect(screen.queryByText("An energy intelligence platform.")).not.toBeInTheDocument();
    });

    it("only one answer is visible at a time", async () => {
        render(<FAQAccordion category={fixture} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole("button", { name: /What is OptiGrid/ }));
        expect(screen.getByText("An energy intelligence platform.")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Is OptiGrid free/ }));
        expect(screen.queryByText("An energy intelligence platform.")).not.toBeInTheDocument();
        expect(screen.getByText("There is a free trial available.")).toBeInTheDocument();
    });

    it("opening an item sets aria-expanded to true on that button", async () => {
        render(<FAQAccordion category={fixture} />);
        const user = userEvent.setup();
        const button = screen.getByRole("button", { name: /What is OptiGrid/ });

        await user.click(button);
        expect(button).toHaveAttribute("aria-expanded", "true");
    });

    it("closing an item resets aria-expanded to false", async () => {
        render(<FAQAccordion category={fixture} />);
        const user = userEvent.setup();
        const button = screen.getByRole("button", { name: /What is OptiGrid/ });

        await user.click(button);
        await user.click(button);

        expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("works with the real Categories data without errors", () => {
        const { Categories } = require("./data");
        expect(() => render(<FAQAccordion category={Categories} />)).not.toThrow();

        const headings = screen.getAllByRole("heading");
        expect(headings.length).toBeGreaterThanOrEqual(Categories.length);
    });
});