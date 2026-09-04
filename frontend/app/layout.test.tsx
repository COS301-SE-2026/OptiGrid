import { render } from "@testing-library/react";
import RootLayout, { metadata } from "./layout";

jest.mock("./providers", () => ({
	Providers: ({ children }: { children: React.ReactNode }) => <div data-testid="providers">{children}</div>,
}));

describe("RootLayout", () => {
	it("shoudl_load_correctly", () => {
		const { getByTestId, getByText } = render(
			<RootLayout><div data-testid="child">Test Child</div></RootLayout>
		);

		expect(getByTestId("providers")).toBeInTheDocument();
		expect(getByTestId("child")).toBeInTheDocument();
		expect(getByText("Test Child")).toBeInTheDocument();
	});

	it("shoudl_export_metadata_correctly", () => {
		expect(metadata.title).toBe("OptiGrid");
		expect(metadata.description).toBe("Energy intelligence platform");
	});
});
