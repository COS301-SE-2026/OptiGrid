import { fireEvent, render, screen, within } from "@testing-library/react";
import { DISPLAY_PREFERENCES_KEY, LIVE_REFRESH_MS, reloadDisplayPreferences } from "@/lib/displayPreferences";
import { FormatsCard, MotionSetting, PerformanceCard, describeRefresh } from "./display-settings";

const SAMPLE = new Date(2026, 9, 25, 14, 5);
const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const ENERGY_OPTIONS: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
const originalMatchMedia = window.matchMedia;

function saved() {
  return JSON.parse(localStorage.getItem(DISPLAY_PREFERENCES_KEY) ?? "{}");
}

function previewValue(term: string) {
  const preview = screen.getByText("Preview").closest(".format-preview") as HTMLElement;
  return within(preview).getByText(term).nextElementSibling?.textContent;
}

function refreshFor(page: string) {
  const row = screen.getByRole("rowheader", { name: page }).closest("tr") as HTMLElement;
  return within(row).getByRole("cell").textContent;
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.motion;
  reloadDisplayPreferences();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe("describeRefresh", () => {
  it("puts each refresh interval into words", () => {
    expect(describeRefresh(LIVE_REFRESH_MS.liveReadings, true, "normal")).toBe("As it happens");
    expect(describeRefresh(LIVE_REFRESH_MS.liveReadings, true, "saver")).toBe("Every 20 seconds");
    expect(describeRefresh(LIVE_REFRESH_MS.dashboard, false, "normal")).toBe("Every minute");
    expect(describeRefresh(LIVE_REFRESH_MS.dashboard, false, "saver")).toBe("Every 4 minutes");
    expect(describeRefresh(LIVE_REFRESH_MS.heatmap, true, "saver")).toBe("Every 2 minutes");
    expect(describeRefresh(LIVE_REFRESH_MS.twinSnapshot, true, "saver")).toBe("Every minute");
    expect(describeRefresh(LIVE_REFRESH_MS.dashboard, false, "paused")).toBe("Paused");
  });
});

describe("MotionSetting", () => {
  it("overrides the device either way and can hand control back", () => {
    render(<MotionSetting />);
    const group = screen.getByRole("group", { name: "Motion" });
    expect(within(group).getByRole("radio", { name: "Match device" })).toBeChecked();
    expect(screen.getByText("Moving")).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("radio", { name: "Reduce" }));
    expect(document.documentElement.dataset.motion).toBe("reduce");
    expect(screen.getByText("Still")).toBeInTheDocument();
    expect(screen.getByText(/Animations stay off on this device/)).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("radio", { name: "Full" }));
    expect(document.documentElement.dataset.motion).toBe("full");
    expect(screen.getByText("Moving")).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("radio", { name: "Match device" }));
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(saved().motion).toBe("system");
  });

  it("says when the device asks for less motion", () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia;

    render(<MotionSetting />);

    expect(screen.getByText("Your device asks for less motion. OptiGrid keeps animations off.")).toBeInTheDocument();
    expect(screen.getByText("Still")).toBeInTheDocument();
  });
});

describe("PerformanceCard", () => {
  it("shows how often each page updates for the chosen mode", () => {
    render(<PerformanceCard />);
    expect(refreshFor("Live readings")).toBe("As it happens");
    expect(refreshFor("Dashboard")).toBe("Every minute");

    fireEvent.click(screen.getByRole("radio", { name: "Data saver" }));
    expect(refreshFor("Live readings")).toBe("Every 20 seconds");
    expect(refreshFor("Dashboard")).toBe("Every 4 minutes");
    expect(refreshFor("Heatmap")).toBe("Every 2 minutes");
    expect(refreshFor("3D building model")).toBe("Every minute");
    expect(screen.getByText("Live streams stay closed and pages check for new data less often.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Paused" }));
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Paused", "Paused", "Paused", "Paused"]);
    expect(saved().liveUpdates).toBe("paused");
  });

  it("saves the 3D graphics choice and reports the screen density", () => {
    render(<PerformanceCard />);
    const group = screen.getByRole("group", { name: "3D graphics" });
    expect(within(group).getByRole("radio", { name: "Auto" })).toBeChecked();
    expect(screen.getByText(/This screen has a pixel density of 1x\./)).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("radio", { name: "Battery saver" }));

    expect(saved().graphics).toBe("saver");
    expect(within(group).getByRole("radio", { name: "Battery saver" })).toBeChecked();
    expect(screen.getByText(/Draws a still scene at a lower resolution\./)).toBeInTheDocument();
  });
});

describe("FormatsCard", () => {
  
  it("switches the preview between clocks", () => {
    render(<FormatsCard />);
    const clock = screen.getByRole("group", { name: "Clock" });
    expect(previewValue("Time")).toBe("14:05");

    fireEvent.click(within(clock).getByRole("radio", { name: "12-hour" }));
    expect(previewValue("Time")).toBe("02:05 PM");
    expect(screen.getByText("Times show on a 12-hour clock everywhere.")).toBeInTheDocument();

    fireEvent.click(within(clock).getByRole("radio", { name: "24-hour" }));
    expect(previewValue("Time")).toBe("14:05");

    fireEvent.click(within(clock).getByRole("radio", { name: "Default" }));
    expect(screen.getByText("Each screen keeps the clock it always used.")).toBeInTheDocument();
    expect(saved().clock).toBe("default");
  });
  
  it("previews the regional format which the user picks", () => {
    render(<FormatsCard />);
    expect(previewValue("Date")).toBe(new Intl.DateTimeFormat("en", DATE_OPTIONS).format(SAMPLE));
    expect(previewValue("Energy")).toBe(`${new Intl.NumberFormat(undefined, ENERGY_OPTIONS).format(12480.5)} kWh`);

    const region = screen.getByRole("group", { name: "Region format" });
    fireEvent.click(within(region).getByRole("radio", { name: "South Africa" }));

    expect(previewValue("Date")).toBe(new Intl.DateTimeFormat("en-ZA", DATE_OPTIONS).format(SAMPLE));
    expect(previewValue("Energy")).toBe(`${new Intl.NumberFormat("en-ZA", ENERGY_OPTIONS).format(12480.5)} kWh`);
    expect(screen.getByText("Spaces group thousands and a comma marks decimals.")).toBeInTheDocument();
    expect(saved().region).toBe("za");
  });
});