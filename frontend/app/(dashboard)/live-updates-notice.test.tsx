import { act, fireEvent, render, screen } from "@testing-library/react";
import { getDisplayPreferences, reloadDisplayPreferences, setDisplayPreferences } from "@/lib/displayPreferences";
import { LiveUpdatesNotice } from "./live-updates-notice";

beforeEach(() => {
    localStorage.clear();
    reloadDisplayPreferences();
});

describe("LiveUpdatesNotice", () => {
    it("stays hidden while the updates run", () => {
        const { container } = render(<LiveUpdatesNotice />);
        expect(container).toBeEmptyDOMElement();

        act(() => {
            setDisplayPreferences({ liveUpdates: "saver" });
        });
        expect(container).toBeEmptyDOMElement();
    });

    it("explains a pause and resumes in one click", () => {
        setDisplayPreferences({ liveUpdates: "paused" });
        render(<LiveUpdatesNotice />);

        expect(screen.getByRole("status")).toHaveTextContent("Live updates are paused on this device.");
        fireEvent.click(screen.getByRole("button", { name: "Resume live updates" }));

        expect(getDisplayPreferences().liveUpdates).toBe("normal");
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});