import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "./logout-button";
import { useRouter } from "next/navigation";

jest.mock("next/navigation", () => ({
	useRouter: jest.fn(),
}));

describe("LogoutButton", () => {
	it("calls logout API and navigates to login", async () => {
		const mockPush = jest.fn();
		const mockRefresh = jest.fn();
		(useRouter as jest.Mock).mockReturnValue({
			push: mockPush,
			refresh: mockRefresh,
		});

		const mockF = jest.fn().mockResolvedValue({});
		global.fetch = mockF as jest.Mock;

		render(<LogoutButton />);
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: /logout/i }));
		expect(mockF).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/login?loggedOut=1");
			expect(mockRefresh).toHaveBeenCalled();
		});
	});
});
