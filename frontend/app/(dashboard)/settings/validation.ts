// These rules match backend/core/src/validation/account.validation.ts
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}'\u2019 .-]*$/u;
export const NAME_MAX_LENGTH = 60;
const PASSWORD_MAX_BYTES = 72;

export type NameFields = {
  firstName: string;
  lastName: string;
};

export type PasswordFields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordCheck = {
  id: "length" | "case" | "number" | "symbol";
  label: string;
  met: boolean;
};

export function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getNameErrors(fields: NameFields): Partial<Record<keyof NameFields, string>> {
  const errors: Partial<Record<keyof NameFields, string>> = {};
  const firstName = normaliseName(fields.firstName);
  const lastName = normaliseName(fields.lastName);

  if (!firstName) {
    errors.firstName = "Enter your first name.";
  } else if (firstName.length > NAME_MAX_LENGTH) {
    errors.firstName = `First name can be at most ${NAME_MAX_LENGTH} characters.`;
  } else if (!NAME_PATTERN.test(firstName)) {
    errors.firstName = "Use letters for names. Hyphens and apostrophes are fine too.";
  }

  if (lastName.length > NAME_MAX_LENGTH) {
    errors.lastName = `Last name can be at most ${NAME_MAX_LENGTH} characters.`;
  } else if (lastName && !NAME_PATTERN.test(lastName)) {
    errors.lastName = "Use letters for names. Hyphens and apostrophes are fine too.";
  }

  return errors;
}

export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { id: "length", label: "At least 8 characters", met: password.length >= 8 },
    { id: "case", label: "Upper and lower case letters", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: "number", label: "At least one number", met: /\d/.test(password) },
    { id: "symbol", label: "At least one symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export type PasswordStrength = {
  score: number;
  label: "" | "Weak" | "Fair" | "Good" | "Strong";
};

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: "" };
  }

  const score = getPasswordChecks(password).filter((check) => check.met).length;
  if (score <= 1) {
    return { score, label: "Weak" };
  }
  if (score < 4) {
    return { score, label: "Fair" };
  }
  return { score, label: password.length >= 12 ? "Strong" : "Good" };
}

// Counts UTF-8 bytes the way bcrypt sees them.
function byteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code < 0x10000) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

export function getPasswordFormErrors(fields: PasswordFields): Partial<Record<keyof PasswordFields, string>> {
  const errors: Partial<Record<keyof PasswordFields, string>> = {};

  if (!fields.currentPassword) {
    errors.currentPassword = "Enter your current password.";
  }

  if (!fields.newPassword) {
    errors.newPassword = "Enter a new password.";
  } else if (getPasswordChecks(fields.newPassword).some((check) => !check.met)) {
    errors.newPassword = "Your new password does not meet every rule below yet.";
  } else if (byteLength(fields.newPassword) > PASSWORD_MAX_BYTES) {
    errors.newPassword = "Your new password is too long. Keep it under 72 characters.";
  } else if (fields.newPassword === fields.currentPassword) {
    errors.newPassword = "Your new password must be different from your current one.";
  }

  if (!fields.confirmPassword) {
    errors.confirmPassword = "Type your new password again.";
  } 
  else if (fields.confirmPassword !== fields.newPassword) {
    errors.confirmPassword = "The new passwords do not match.";
  }

  return errors;
}