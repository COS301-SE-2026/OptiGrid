import {
  getNameErrors,
  getPasswordChecks,
  getPasswordFormErrors,
  getPasswordStrength,
  normaliseName,
} from "./validation";

describe("settings validation", () => {
  describe("names", () => {
    it("tidies spacing", () => {
      expect(normaliseName("  van   der  Merwe ")).toBe("van der Merwe");
    });

    it.each([
      ["Thandi", "Mokoena"],
      ["Seán", "O'Connor"],
      ["Zoë", ""],
      ["Mary-Jane", "St. Clair"],
    ])("accepts %s %s", (firstName, lastName) => {
      expect(getNameErrors({ firstName, lastName })).toEqual({});
    });

    it("needs a first name", () => {
      expect(getNameErrors({ firstName: "  ", lastName: "Mokoena" })).toEqual({ firstName: "Enter your first name." });
    });

    it("rejects digits and symbols", () => {
      expect(getNameErrors({ firstName: "Th4ndi", lastName: "<b>" })).toEqual({
        firstName: "Use letters for names. Hyphens and apostrophes are fine too.",
        lastName: "Use letters for names. Hyphens and apostrophes are fine too.",
      });
    });

    it("limits names to 60 characters", () => {
      expect(getNameErrors({ firstName: "A".repeat(61), lastName: "B".repeat(61) })).toEqual({
        firstName: "First name can be at most 60 characters.",
        lastName: "Last name can be at most 60 characters.",
      });
    });
  });

  describe("passwords", () => {
    it("reports each rule separately", () => {
      expect(getPasswordChecks("abc").map((check) => check.met)).toEqual([false, false, false, false]);
      expect(getPasswordChecks("Abcdefg1!").map((check) => check.met)).toEqual([true, true, true, true]);
    });

    it.each([
      ["", 0, ""],
      ["abcdefgh", 1, "Weak"],
      ["abcdefgh1", 2, "Fair"],
      ["Abcdefgh1", 3, "Fair"],
      ["Abcdefg1!", 4, "Good"],
      ["Abcdefgh1!xyz", 4, "Strong"],
    ])("rates %p as %s", (password, score, label) => {
      expect(getPasswordStrength(password)).toEqual({ score, label });
    });

    it("accepts a complete change", () => {
      expect(getPasswordFormErrors({
        currentPassword: "OldPass123!",
        newPassword: "NewPass456!",
        confirmPassword: "NewPass456!",
      })).toEqual({});
    });

  
    it("catches each kind of bad new password", () => {
      expect(getPasswordFormErrors({ currentPassword: "x", newPassword: "weak", confirmPassword: "weak" }).newPassword)
        .toBe("Your new password does not meet every rule below yet.");
      expect(getPasswordFormErrors({ currentPassword: "Same123!", newPassword: "Same123!x", confirmPassword: "Same123!y" }).confirmPassword)
        .toBe("The new passwords do not match.");
      expect(getPasswordFormErrors({ currentPassword: "SamePass1!", newPassword: "SamePass1!", confirmPassword: "SamePass1!" }).newPassword)
        .toBe("Your new password must be different from your current one.");
    });

    it("lists every missing field", () => {
      expect(getPasswordFormErrors({ currentPassword: "", newPassword: "", confirmPassword: "" })).toEqual({
        currentPassword: "Enter your current password.",
        newPassword: "Enter a new password.",
        confirmPassword: "Type your new password again.",
      });
    });

    it("counts bytes like bcrypt does", () => {
      const longInBytes = `Aa1!${"é".repeat(40)}`;
      expect(longInBytes.length).toBeLessThan(72);
      expect(getPasswordFormErrors({ currentPassword: "x", newPassword: longInBytes, confirmPassword: longInBytes }).newPassword)
        .toBe("Your new password is too long. Keep it under 72 characters.");
    });
  });
});