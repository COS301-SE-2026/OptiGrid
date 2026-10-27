import {
  AccountRequestError,
  changePassword,
  exportFileName,
  fetchSessionProfile,
  saveProfile,
  signOutEverywhere,
} from "./account-api";

function reply(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("account api helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads the file name from the download header", () => {
    expect(exportFileName('attachment; filename="optigrid-my-data-2026-10-25.json"')).toBe("optigrid-my-data-2026-10-25.json");
    expect(exportFileName("attachment; filename=plain.json")).toBe("plain.json");
    expect(exportFileName(null)).toBe("optigrid-my-data.json");
  });

  it("turns validation replies into field errors", async () => {
    global.fetch = jest.fn(() => reply(400, {
      message: "Validation error",
      errors: [
        { field: "firstName", message: "Enter your first name." },
        { field: "firstName", message: "A second problem" },
      ],
    })) as jest.Mock;

    const error = await saveProfile({ firstName: "", lastName: "" }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AccountRequestError);
    expect(error.status).toBe(400);
    expect(error.fieldErrors).toEqual({ firstName: "Enter your first name." });
    expect(error.message).toBe("We could not save your profile. Please try again.");
  });

  it("keeps a specific server message and its code", async () => {
    global.fetch = jest.fn(() => reply(409, {
      code: "PASSWORD_NOT_AVAILABLE",
      message: "This account signs in with Google. Its password is managed by Google.",
    })) as jest.Mock;

    const error = await changePassword({ currentPassword: "a", newPassword: "b" }).catch((caught) => caught);

    expect(error.code).toBe("PASSWORD_NOT_AVAILABLE");
    expect(error.message).toBe("This account signs in with Google. Its password is managed by Google.");
  });

  it("falls back to the login page when the sign out reply has no redirect", async () => {
    global.fetch = jest.fn(() => reply(200, {})) as jest.Mock;

    await expect(signOutEverywhere()).resolves.toEqual({ redirectTo: "/login?signedOut=all" });
  });

  it("builds a profile from the session reply", async () => {
    global.fetch = jest.fn(() => reply(200, { userId: "u1", email: "a@example.com", firstName: "Ada" })) as jest.Mock;

    await expect(fetchSessionProfile()).resolves.toEqual({
      userId: "u1",
      email: "a@example.com",
      firstName: "Ada",
      lastName: "",
      roleType: "VIEWER",
    });
  });
});