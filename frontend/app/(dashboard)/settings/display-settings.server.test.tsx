/**
 * @jest-environment node
 */
import { renderToString } from "react-dom/server";
import { FormatsCard, PerformanceCard } from "./display-settings";

describe("display settings on the server", () => {
  it("sends a preview that does not depend on the browser locale", () => {
    const numberFormat = jest.spyOn(Intl, "NumberFormat");
    const html = renderToString(<FormatsCard />);

    expect(numberFormat.mock.calls.map(([locale]) => locale)).toEqual(["en-US", "en-US"]);
    expect(html).toContain("12,480.5<!-- --> kWh");
    expect(html).toContain("R <!-- -->23,456.78");
    expect(html).toContain("14:05");
    numberFormat.mockRestore();
  });

  it("leaves the pixel density out until the browser can measure it", () => {
    const html = renderToString(<PerformanceCard />);

    expect(html).toContain("As it happens");
    expect(html).not.toContain("pixel density");
  });
});