import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import OptiGridStyleGuide from "./page";

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe("OptiGridStyleGuide", () => {
  it("renders the heading", () => {
    render(<OptiGridStyleGuide />);
    expect(screen.getByText("OptiGrid Brand Guide")).toBeInTheDocument();
  });

  it("renders every section link in the navbar", () => {
    render(<OptiGridStyleGuide />);
    const nav = screen.getByRole("navigation");

    [
      "Introduction",
      "Logo & Iconography",
      "Typography",
      "Colour Palette",
      "Design Tokens",
      "Components",
      "Design Principles",
      "Accessibility",
      "Voice & Tone",
      "Changelog",
    ].forEach((label) => {
      
      expect(within(nav).getByRole("button", { name: label })).toBeInTheDocument();
    });
  });

  it("scrolls to a section when its link is clicked", () => {
    render(<OptiGridStyleGuide />);
    const nav = screen.getByRole("navigation");
    const colorPaletteButton = within(nav).getByRole("button", { name: "Colour Palette" });
    
    fireEvent.click(colorPaletteButton);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});