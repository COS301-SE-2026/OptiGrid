import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ManualPage from "./page"; 
import userEvent from "@testing-library/user-event";


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



  describe("Snapshot ", () => {
  const getSnapshotButton = () =>
    screen.getByRole("button", { name: `Enlarge image: ${LANDING_ALT}` });

  it(" opens the lightbox on click", () => {
    render(<ManualPage />);

    const snapshot = getSnapshotButton();
  expect(snapshot.tagName).toBe("BUTTON");
  expect(snapshot).toHaveAttribute("type", "button");
  expect(snapshot).toBeEnabled();

  fireEvent.click(snapshot);

  expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", LANDING_ALT);


    
  });

  it.each([
  ["Enter", "{Enter}"],
  ["Space", " "],
])("opens the lightbox when %s is pressed on the focused button", async (_label, key) => {
  const user = userEvent.setup();
  render(<ManualPage />);

  await user.tab(); 
  getSnapshotButton().focus();
  expect(getSnapshotButton()).toHaveFocus();

  await user.keyboard(key);

  expect(screen.getByRole("dialog")).toBeInTheDocument();
});




  it("ignores other keys", () => {
    render(<ManualPage />);

    const notPrevented = fireEvent.keyDown(getSnapshotButton(), { key: "a" });

    expect(notPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lifts the card on mouse", () => {
    render(<ManualPage />);

    const snapshot = getSnapshotButton();
    expect(snapshot).toHaveStyle({ transform: "translateY(0)" });

    fireEvent.mouseEnter(snapshot);
    expect(snapshot).toHaveStyle({ transform: "translateY(-2px)" });

    fireEvent.mouseLeave(snapshot);
    expect(snapshot).toHaveStyle({ transform: "translateY(0)" });
  });


  describe("contents navigation", () => {
  beforeEach(() => scrollIntoViewMock.mockClear());

  it("scrolls the clicked section into view", () => {
    render(<ManualPage />);

    fireEvent.click(
      within(screen.getByRole("navigation")).getByText("Energy Demand Forecasting")
    );

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    
    expect(scrollIntoViewMock.mock.contexts[0]).toBe(
      document.getElementById("forecast")
    );
  });

  it("moves the active highlight to the clicked entry", () => {
    render(<ManualPage />);

    const buttons = within(screen.getByRole("navigation")).getAllByRole("button");
    const first = buttons[0]; 
    const target = buttons[3]; 

    
    expect(first.style.background).not.toBe("transparent");
    expect(target.style.background).toBe("transparent");

    fireEvent.click(target);

    expect(target.style.background).not.toBe("transparent");
    expect(first.style.background).toBe("transparent");
  });

  it("does not throw or scroll when the target section is not in the DOM", () => {
    render(<ManualPage />);

    const spy = jest.spyOn(document, "getElementById").mockReturnValueOnce(null);

    expect(() =>
      fireEvent.click(
        within(screen.getByRole("navigation")).getByText("Troubleshooting")
      )
    ).not.toThrow();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    spy.mockRestore();
  });
});

});

});

