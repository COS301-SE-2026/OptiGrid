export type AccountProfile = {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roleType: string;
  preferredTheme?: string;
  createdAt?: string | null;
};

export type AccountSecurity = {
  signInMethods: string[];
  canChangePassword: boolean;
  lastSignInAt: string | null;
};

export type AccountOverview = {
  user: AccountProfile;
  security: AccountSecurity | null;
};

export type PasswordChangeRequest = {
  currentPassword: string;
  newPassword: string;
  signOutOtherDevices: boolean;
};

export class AccountRequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, status: number, fieldErrors: Record<string, string> = {}, code?: string) {
    super(message);
    this.name = "AccountRequestError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

// The core API sends these when it has nothing useful for a person to read. The caller's own wording is shown instead.
const PLAIN_SERVER_MESSAGES = new Set(["Validation error", "Internal server error"]);
const DEFAULT_EXPORT_NAME = "optigrid-my-data.json";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function toRequestError(response: Response, fallback: string): Promise<AccountRequestError> {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const fieldErrors: Record<string, string> = {};

  if (Array.isArray(payload.errors)) {
    for (const issue of payload.errors as Array<Record<string, unknown>>) {
      const field = text(issue?.field);
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = text(issue?.message);
      }
    }
  }
  if (text(payload.field)) {
    fieldErrors[text(payload.field)] = text(payload.message);
  }

  if (response.status === 429) {
    return new AccountRequestError("Too many attempts. Wait a minute, then try again.", 429, fieldErrors);
  }

  const message = text(payload.message);
  return new AccountRequestError(
    message && !PLAIN_SERVER_MESSAGES.has(message) ? message : fallback,
    response.status,
    fieldErrors,
    text(payload.code) || undefined,
  );
}

function jsonRequest(method: "PUT" | "POST", body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  };
}

export async function fetchAccount(): Promise<AccountOverview> {
  const response = await fetch("/api/accounts/me", { cache: "no-store" });
  if (!response.ok) {
    throw await toRequestError(response, "We could not load your account.");
  }
  return (await response.json()) as AccountOverview;
}

// The session cookie still holds the name and role. The page can show those when the account service is down.
export async function fetchSessionProfile(): Promise<AccountProfile> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (!response.ok) {
    throw await toRequestError(response, "We could not load your profile.");
  }

  const user = (await response.json()) as Record<string, unknown>;
  return {
    userId: text(user.userId),
    email: text(user.email),
    firstName: text(user.firstName),
    lastName: text(user.lastName),
    roleType: text(user.roleType) || "VIEWER",
  };
}

export async function saveProfile(names: { firstName: string; lastName: string }): Promise<AccountProfile> {
  const response = await fetch("/api/accounts/me", jsonRequest("PUT", names));
  if (!response.ok) {
    throw await toRequestError(response, "We could not save your profile. Please try again.");
  }

  const payload = (await response.json()) as { user: AccountProfile };
  return payload.user;
}

export async function changePassword(change: PasswordChangeRequest): Promise<{ signedOutOtherDevices: boolean }> {
  const response = await fetch("/api/accounts/me/password", jsonRequest("POST", change));
  if (!response.ok) {
    throw await toRequestError(response, "We could not change your password. Please try again.");
  }

  const payload = (await response.json()) as { signedOutOtherDevices?: unknown };
  return { signedOutOtherDevices: payload.signedOutOtherDevices === true };
}

export async function signOutEverywhere(): Promise<{ redirectTo: string }> {
  const response = await fetch("/api/accounts/me/sign-out-everywhere", jsonRequest("POST"));
  if (!response.ok) {
    throw await toRequestError(response, "We could not sign you out everywhere. Please try again.");
  }

  const payload = (await response.json()) as { redirectTo?: unknown };
  return { redirectTo: text(payload.redirectTo) || "/login?signedOut=all" };
}

export function exportFileName(disposition: string | null): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1]?.trim() || DEFAULT_EXPORT_NAME;
}

export async function downloadPersonalData(): Promise<string> {
  const response = await fetch("/api/accounts/me/export", { cache: "no-store" });
  if (!response.ok) {
    throw await toRequestError(response, "We could not prepare your file. Please try again in a minute.");
  }

  const fileName = exportFileName(response.headers.get("content-disposition"));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}