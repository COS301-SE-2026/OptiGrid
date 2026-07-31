import { fireEvent, render, screen } from "@testing-library/react";
import { TabSessionProvider } from "./tab-session-provider";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../lib/tab-session", () => ({
  TAB_SESSION_HEADER: "x-optigrid-tab-id",
  getTabSessionId: () => "00000000-0000-4000-8000-000000000001",
  getTabSessionPath: (pathname: string, tabSessionId: string) => `/_sessions/${tabSessionId}${pathname}`,
}));

describe("TabSessionProvider", () => {
  beforeEach(() => {
    mockPush.mockClear();
    global.fetch = jest.fn();
  });

  it("uses client-side navigation when scoping an internal link", () => {
    render(
      <TabSessionProvider>
        <a href="/buildings/add">Add building</a>
      </TabSessionProvider>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Add building" }));

    expect(mockPush).toHaveBeenCalledWith("/_sessions/00000000-0000-4000-8000-000000000001/buildings/add");
  });
});
