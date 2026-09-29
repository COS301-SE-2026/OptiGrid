import { fireEvent, screen } from "@testing-library/react";

export function chooseCurvedOption(trigger: HTMLElement, value: string) {
    fireEvent.click(trigger);
    const option = screen.getAllByRole("option").find((item) => item.getAttribute("data-value") === value);
    if (!option) {
        throw new Error(`No option with value "${value}" in ${trigger.id || "the dropdown"}`);
    }
    fireEvent.mouseDown(option);
}

export function openCurvedSelect(trigger: HTMLElement) {
    fireEvent.click(trigger);
    return screen.getAllByRole("option");
}
