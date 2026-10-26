"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import { openDialog } from "@/lib/openDialog";
import { formatDateTime } from "@/lib/format";
import {
  AccountRequestError,
  changePassword,
  signOutEverywhere,
  type AccountSecurity,
} from "./account-api";
import {
  getPasswordChecks,
  getPasswordFormErrors,
  getPasswordStrength,
  type PasswordFields,
} from "./validation";

type SecurityCardProps = Readonly<{
  security: AccountSecurity | null;
  loading: boolean;
  onNotify: (message: string) => void;
}>;

const EMPTY_PASSWORD_FIELDS: PasswordFields = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const GOOGLE_SECURITY_URL = "https://myaccount.google.com/security";

function describeSignIn(methods: string[]): string {
  const email = methods.includes("email");
  const google = methods.includes("google");
  if (email && google) {
    return "Email and password, or Google";
  }
  if (google) {
    return "Google";
  }
  return email ? "Email and password" : "Unknown";
}

function formatSignInTime(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDateTime(date, { dateStyle: "medium", timeStyle: "short" });
}

function RuleIcon({ met }: Readonly<{ met: boolean }>) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {met ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="4" />}
    </svg>
  );
}

function PasswordForm({ onDone, onCancel }: Readonly<{ onDone: (signedOutOthers: boolean) => void; onCancel: () => void }>) {
  const [fields, setFields] = useState<PasswordFields>(EMPTY_PASSWORD_FIELDS);
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordFields, string>>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    currentRef.current?.querySelector("input")?.focus();
  }, []);

  const checks = getPasswordChecks(fields.newPassword);
  const strength = getPasswordStrength(fields.newPassword);

  const update = (name: keyof PasswordFields, value: string) => {
    setFields((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) {
      setErrors((previous) => ({ ...previous, [name]: undefined }));
    }
    setFormError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = getPasswordFormErrors(fields);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const result = await changePassword({
        currentPassword: fields.currentPassword,
        newPassword: fields.newPassword,
        signOutOtherDevices: signOutOthers,
      });
      onDone(result.signedOutOtherDevices);
    } catch (error) {
      if (error instanceof AccountRequestError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(error.fieldErrors as Partial<Record<keyof PasswordFields, string>>);
      } else {
        setFormError(error instanceof Error && error.message ? error.message : "We could not change your password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldProps = (name: keyof PasswordFields) => ({
    id: name,
    name,
    value: fields[name],
    disabled: saving,
    ariaInvalid: Boolean(errors[name]),
    ariaDescribedBy: errors[name] ? `${name}-error` : undefined,
    className: `input${errors[name] ? " is-invalid" : ""}`,
    onChange: (event: { target: { value: string } }) => update(name, event.target.value),
  });

  return (
    <form className="settings-password-form" aria-label="Change password" noValidate onSubmit={handleSubmit}>
      <div className="settings-field" ref={currentRef}>
        <label className="label" htmlFor="currentPassword">Current password</label>
        <PasswordInput {...fieldProps("currentPassword")} autoComplete="current-password" />
        {errors.currentPassword && <p id="currentPassword-error" className="settings-field-error">{errors.currentPassword}</p>}
      </div>

      <div className="settings-field">
        <label className="label" htmlFor="newPassword">New password</label>
        <PasswordInput
          {...fieldProps("newPassword")}
          autoComplete="new-password"
          ariaDescribedBy={errors.newPassword ? "newPassword-error newPassword-rules" : "newPassword-rules"}
        />
        {errors.newPassword && <p id="newPassword-error" className="settings-field-error">{errors.newPassword}</p>}
        <div className="password-strength" data-score={strength.score} aria-hidden={!strength.label}>
          <span className="password-strength-bar">
            {[1, 2, 3, 4].map((segment) => (
              <span key={segment} className={`password-strength-segment${strength.score >= segment ? " is-filled" : ""}`} />
            ))}
          </span>
          <span className="password-strength-label">{strength.label ? `Strength: ${strength.label}` : ""}</span>
        </div>
        <ul id="newPassword-rules" className="password-rules" aria-label="Password rules">
          {checks.map((check) => (
            <li key={check.id} className={check.met ? "is-met" : undefined}>
              <RuleIcon met={check.met} />
              <span>{check.label}</span>
              <span className="sr-only">{check.met ? "(done)" : "(not yet)"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="settings-field">
        <label className="label" htmlFor="confirmPassword">Confirm new password</label>
        <PasswordInput {...fieldProps("confirmPassword")} autoComplete="new-password" />
        {errors.confirmPassword && <p id="confirmPassword-error" className="settings-field-error">{errors.confirmPassword}</p>}
      </div>

      <div className="settings-check">
        <input
          id="signOutOtherDevices"
          type="checkbox"
          checked={signOutOthers}
          onChange={(event) => setSignOutOthers(event.target.checked)}
          disabled={saving}
          aria-describedby="signOutOtherDevices-hint"
        />
        <span>
          <label htmlFor="signOutOtherDevices" className="settings-check-label">Sign out of my other devices</label>
          <span id="signOutOtherDevices-hint" className="settings-field-hint">A good idea if someone else might know your old password.</span>
        </span>
      </div>

      {formError && <div role="alert" className="auth-alert">{formError}</div>}

      <div className="settings-actions settings-actions-inline">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}

export function SecurityCard({ security, loading, onNotify }: SecurityCardProps) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const formWasOpen = useRef(false);

  useEffect(() => {
    if (confirmOpen) {
      openDialog(dialogRef.current);
    }
  }, [confirmOpen]);

  // The button returns only after the form closes
  useEffect(() => {
    if (!formOpen && formWasOpen.current) {
      changeButtonRef.current?.focus();
    }
    formWasOpen.current = formOpen;
  }, [formOpen]);

  const closeForm = () => {
    setFormOpen(false);
  };

  const handlePasswordChanged = (signedOutOthers: boolean) => {
    setFormOpen(false);
    setPasswordMessage(signedOutOthers
      ? "Password updated. Your other devices were signed out."
      : "Password updated.");
    onNotify("Password updated");
  };

  const handleSignOutEverywhere = async () => {
    setSigningOut(true);
    setSignOutError("");
    try {
      const { redirectTo } = await signOutEverywhere();
      setConfirmOpen(false);
      onNotify("Signed out everywhere");
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setSignOutError(error instanceof Error && error.message ? error.message : "We could not sign you out everywhere. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  const methods = security?.signInMethods ?? [];
  const lastSignIn = formatSignInTime(security?.lastSignInAt ?? null);

  let passwordBody;
  if (loading) {
    passwordBody = <p className="text-muted settings-row-text">Checking how you sign in...</p>;
  } else if (!security) {
    passwordBody = <p className="text-muted settings-row-text">We could not check how you sign in right now. Refresh the page to try again.</p>;
  } else if (!security.canChangePassword) {
    passwordBody = (
      <p className="text-muted settings-row-text">
        You sign in with Google. There is no OptiGrid password to change.{" "}
        <a href={GOOGLE_SECURITY_URL} target="_blank" rel="noopener noreferrer">Manage your Google password</a>
      </p>
    );
  } else {
    passwordBody = (
      <>
        <div className="settings-row-head">
          <p className="text-muted settings-row-text">Use a password you do not use on any other site.</p>
          {!formOpen && (
            <button
              ref={changeButtonRef}
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPasswordMessage("");
                setFormOpen(true);
              }}
            >
              Change password
            </button>
          )}
        </div>
        {formOpen && <PasswordForm onDone={handlePasswordChanged} onCancel={closeForm} />}
        {passwordMessage && <p className="settings-note is-success" role="status">{passwordMessage}</p>}
      </>
    );
  }

  return (
    <section aria-labelledby="settings-security-title" className="card settings-card">
      <h2 id="settings-security-title" className="dashboard-section-title settings-card-title">Security</h2>

      <dl className="settings-facts">
        <div>
          <dt>Sign-in method</dt>
          <dd>{loading ? "..." : security ? describeSignIn(methods) : "Not available"}</dd>
        </div>
        <div>
          <dt>Last sign-in</dt>
          <dd>{loading ? "..." : lastSignIn || "Not available"}</dd>
        </div>
      </dl>

      <div className="settings-block">
        <h3 className="settings-block-title">Password</h3>
        {passwordBody}
      </div>

      <div className="settings-block">
        <h3 className="settings-block-title">Sign out of all devices</h3>
        <div className="settings-row-head">
          <p className="text-muted settings-row-text">
            Used OptiGrid on a shared or lost device? End every session in one step. This device is signed out as well.
          </p>
          <button
            type="button"
            className="btn btn-secondary settings-danger-outline"
            onClick={() => {
              setSignOutError("");
              setConfirmOpen(true);
            }}
          >
            Sign out everywhere
          </button>
        </div>
      </div>

      {confirmOpen && (
        <dialog
          ref={dialogRef}
          className="modal"
          aria-labelledby="sign-out-everywhere-title"
          aria-describedby="sign-out-everywhere-text"
          onClose={() => setConfirmOpen(false)}
        >
          <h2 id="sign-out-everywhere-title" className="settings-dialog-title">Sign out of all devices?</h2>
          <p id="sign-out-everywhere-text" className="text-muted">
            Every browser signed in to your account will be logged out straight away, including this one.
            You can log in again with your usual details.
          </p>
          {signOutError && <div role="alert" className="auth-alert settings-dialog-alert">{signOutError}</div>}
          <div className="settings-dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmOpen(false)} disabled={signingOut}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={handleSignOutEverywhere} disabled={signingOut}>
              {signingOut ? "Signing out..." : "Sign out everywhere"}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}