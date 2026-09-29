import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ManualPage from "./page"; 

const LANDING_ALT =
  "Landing page with hero, live portfolio panel and call to action";

describe("ManualPage", () => {
  const scrollIntoViewMock = jest.fn();

  beforeAll(() => {
    
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  beforeEach(() => {
    scrollIntoViewMock.mockClear();
    document.body.style.overflow = "";
  });

  it("renders the manual title, version badges and all 16 contents entries", () => {
    render(<ManualPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "OptiGrid User Manual" })
    ).toBeInTheDocument();
    expect(screen.getByText("Version 1.0")).toBeInTheDocument();
    expect(screen.getByText("Team Coreflow")).toBeInTheDocument();

    const nav = screen.getByRole("navigation");
    expect(within(nav).getAllByRole("button")).toHaveLength(16);
    expect(within(nav).getByText("Introduction")).toBeInTheDocument();
    expect(
      within(nav).getByText("Getting Help and Support")
    ).toBeInTheDocument();
  });


  it("opens the lightbox when a screenshot is clicked and closes it with Escape", () => {
    render(<ManualPage />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `Enlarge image: ${LANDING_ALT}` })
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", LANDING_ALT);
    expect(within(dialog).getByRole("img")).toHaveAttribute(
      "src",
      "/landingpage.png"
    );
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes the lightbox via the close button", () => {
    render(<ManualPage />);

    fireEvent.click(
      screen.getByRole("button", { name: `Enlarge image: ${LANDING_ALT}` })
    );
    const dialog = screen.getByRole("dialog");

    
    fireEvent.click(within(dialog).getByRole("img"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close enlarged image" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the user roles table and the permanent-deletion warning", () => {
    render(<ManualPage />);

    const rolesSection = document.getElementById("roles") as HTMLElement;
    const table = within(rolesSection).getByRole("table");

    expect(
      within(table).getByRole("columnheader", { name: "Role" })
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Capabilities" })
    ).toBeInTheDocument();
    expect(within(table).getByText("Viewer")).toBeInTheDocument();
    expect(within(table).getByText("Building Manager")).toBeInTheDocument();
    expect(within(table).getByText("Administrator")).toBeInTheDocument();

    const buildingsSection = document.getElementById("buildings") as HTMLElement;
    expect(
      within(buildingsSection).getByText(
        "Deleting a building is a permanent action and cannot be undone."
      )
    ).toBeInTheDocument();
  });
});