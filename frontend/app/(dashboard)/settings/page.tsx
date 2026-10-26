"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { openDialog } from "@/lib/openDialog";
import { formatDate } from "@/lib/format";
import { useFormatPreferences } from "@/lib/useDisplayPreferences";
import {
  fetchAccount,
  fetchSessionProfile,
  saveProfile,
  AccountRequestError,
  type AccountOverview,
  type AccountProfile,
} from "./account-api";
import { getNameErrors, NAME_MAX_LENGTH, normaliseName, type NameFields } from "./validation";
import { AppearanceCard } from "./appearance-card";
import { SecurityCard } from "./security-card";
import { DataCard } from "./data-card";
import { FormatsCard, PerformanceCard } from "./display-settings";

type LoadState = "loading" | "ready" | "partial";

const EMPTY_NAMES: NameFields = { firstName: "", lastName: "" };

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  BUILDING_MANAGER: "Manager",
  VIEWER: "User",
};

function namesOf(user: AccountProfile): NameFields {
  return { firstName: user.firstName ?? "", lastName: user.lastName ?? "" };
}

function initialsOf(names: NameFields, email: string): string {
  const initials = `${names.firstName.trim().charAt(0)}${names.lastName.trim().charAt(0)}`.toUpperCase();
  return initials || email.slice(0, 2).toUpperCase() || "?";
}

function memberSince(createdAt: string | null | undefined): string {
  if (!createdAt) {
    return "";
  }
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? "" : formatDate(date, { month: "long", year: "numeric" });
}

export default function SettingsPage() {
  const router = useRouter();
  useFormatPreferences();

  const [account, setAccount] = useState<AccountOverview | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [savedNames, setSavedNames] = useState<NameFields>(EMPTY_NAMES);
  const [draftNames, setDraftNames] = useState<NameFields>(EMPTY_NAMES);
  const [nameErrors, setNameErrors] = useState<Partial<Record<keyof NameFields, string>>>({});
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (showDeleteModal) {
      openDialog(deleteDialogRef.current);
    }
  }, [showDeleteModal]);

  const showToastMessage = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToastMessage(""), 3000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
  }, []);

  const applyProfile = useCallback((user: AccountProfile) => {
    const names = namesOf(user);
    setSavedNames(names);
    setDraftNames(names);
    setNameErrors({});
  }, []);

  const loadAccount = useCallback(async (isActive: () => boolean = () => true) => {
    setLoadState("loading");
    try {
      const overview = await fetchAccount();
      if (!isActive()) {
        return;
      }
      setAccount(overview);
      applyProfile(overview.user);
      setLoadState("ready");
    } catch (error) {
      console.error("Failed to load account settings", error);
      try {
        const sessionProfile = await fetchSessionProfile();
        if (isActive()) {
          setAccount({ user: sessionProfile, security: null });
          applyProfile(sessionProfile);
        }
      } catch {
        //the banner below explains what happened.
      }
      if (isActive()) {
        setLoadState("partial");
      }
    }
  }, [applyProfile]);

  useEffect(() => {
    let active = true;
    void loadAccount(() => active);
    return () => {
      active = false;
    };
  }, [loadAccount]);

  const profile = account?.user;
  const email = profile?.email ?? "";
  const roleLabel = ROLE_LABELS[profile?.roleType ?? ""] ?? "User";
  const loading = loadState === "loading";
  const normalisedDraft = {
    firstName: normaliseName(draftNames.firstName),
    lastName: normaliseName(draftNames.lastName),
  };
  const profileChanged = normalisedDraft.firstName !== savedNames.firstName
    || normalisedDraft.lastName !== savedNames.lastName;
  const displayName = [normalisedDraft.firstName, normalisedDraft.lastName].filter(Boolean).join(" ");
  const since = memberSince(profile?.createdAt);

  const updateName = (field: keyof NameFields, value: string) => {
    setDraftNames((previous) => ({ ...previous, [field]: value }));
    if (nameErrors[field]) {
      setNameErrors((previous) => ({ ...previous, [field]: undefined }));
    }
    setProfileError("");
  };

  const handleSaveChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problems = getNameErrors(draftNames);
    if (Object.keys(problems).length > 0) {
      setNameErrors(problems);
      return;
    }
    if (!profileChanged) {
      return;
    }

    setSavingProfile(true);
    setProfileError("");
    try {
      const user = await saveProfile(normalisedDraft);
      applyProfile(user);
      setAccount((current) => (current ? { ...current, user: { ...current.user, ...user } } : current));
      showToastMessage("Profile saved");
      router.refresh();
    } catch (error) {
      if (error instanceof AccountRequestError && Object.keys(error.fieldErrors).length > 0) {
        setNameErrors(error.fieldErrors as Partial<Record<keyof NameFields, string>>);
      } else {
        setProfileError(error instanceof Error && error.message ? error.message : "We could not save your profile. Please try again.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDiscardChanges = () => {
    setDraftNames(savedNames);
    setNameErrors({});
    setProfileError("");
  };

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to logout?")) {
      return;
    }

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        showToastMessage("Unable to log out");
        return;
      }

      showToastMessage("Logged out");
      setTimeout(() => {
        router.push("/login?loggedOut=1");
        router.refresh();
      }, 500);
    } catch (error) {
      console.error("Failed to log out", error);
      showToastMessage("Unable to log out");
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await fetch("/api/accounts/me/deactivate", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setShowDeleteModal(false);
        showToastMessage(typeof payload?.message === "string" ? payload.message : "Unable to delete your account");
        return;
      }

      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      setShowDeleteModal(false);
      showToastMessage("Account deleted");
      router.push("/login?deleted=1");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete account", error);
      setShowDeleteModal(false);
      showToastMessage("Unable to delete your account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="settings-page">
          <div className="dashboard-header dashboard-page-heading">
            <div>
              <h1 className="dashboard-title">Settings</h1>
              <p className="dashboard-subtitle">Manage your account and how OptiGrid looks and runs.</p>
            </div>
            <span className="badge badge-default">{roleLabel}</span>
          </div>

          {loadState === "partial" && (
            <div className="settings-banner" role="alert">
              <p>Some account details could not be loaded. What you see may be out of date.</p>
              <button type="button" className="btn btn-secondary" onClick={() => void loadAccount()}>
                Try again
              </button>
            </div>
          )}

          <div className="settings-grid">
          <div className="settings-column">
          <section aria-labelledby="settings-profile-title" className="card settings-card settings-profile">
              <h2 id="settings-profile-title" className="dashboard-section-title settings-card-title">Profile</h2>

              <div className="settings-identity">
                <span className="settings-avatar" aria-hidden="true">{initialsOf(normalisedDraft, email)}</span>
                <div className="settings-identity-text">
                  <p className="settings-identity-name">{displayName || (loading ? "Loading your profile..." : "Add your name")}</p>
                  {since && <p className="text-muted settings-identity-meta">Member since {since}</p>}
                </div>
              </div>

              <form className="settings-profile-form" noValidate onSubmit={handleSaveChanges} aria-busy={loading}>
                <div className="settings-fields">
                  <div className="settings-field">
                    <label className="label" htmlFor="firstName">First name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      maxLength={NAME_MAX_LENGTH}
                      value={draftNames.firstName}
                      onChange={(event) => updateName("firstName", event.target.value)}
                      className={`input${nameErrors.firstName ? " is-invalid" : ""}`}
                      placeholder="Enter first name"
                      disabled={loading || savingProfile}
                      aria-invalid={Boolean(nameErrors.firstName)}
                      aria-describedby={nameErrors.firstName ? "firstName-error" : undefined}
                    />
                    {nameErrors.firstName && <p id="firstName-error" className="settings-field-error">{nameErrors.firstName}</p>}
                  </div>

                  <div className="settings-field">
                    <label className="label" htmlFor="lastName">Last name</label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      maxLength={NAME_MAX_LENGTH}
                      value={draftNames.lastName}
                      onChange={(event) => updateName("lastName", event.target.value)}
                      className={`input${nameErrors.lastName ? " is-invalid" : ""}`}
                      placeholder="Enter last name"
                      disabled={loading || savingProfile}
                      aria-invalid={Boolean(nameErrors.lastName)}
                      aria-describedby={nameErrors.lastName ? "lastName-error" : undefined}
                    />
                    {nameErrors.lastName && <p id="lastName-error" className="settings-field-error">{nameErrors.lastName}</p>}
                  </div>

                  <div className="settings-field">
                    <label className="label" htmlFor="email">Email address</label>
                    <input id="email" type="email" value={email} className="input" disabled aria-describedby="email-hint" />
                    <p id="email-hint" className="settings-field-hint">This is the address you sign in with. It cannot be changed here.</p>
                  </div>

                  <div className="settings-field">
                    <label className="label" htmlFor="role">Role</label>
                    <input id="role" type="text" value={roleLabel} className="input" disabled aria-describedby="role-hint" />
                    <p id="role-hint" className="settings-field-hint">An administrator decides your role.</p>
                  </div>
                </div>

                {profileError && <div role="alert" className="auth-alert settings-form-alert">{profileError}</div>}

                <div className="settings-actions">
                  <p className="settings-unsaved" aria-live="polite">{profileChanged ? "You have unsaved changes." : ""}</p>
                  <button
                    type="button"
                    onClick={handleDiscardChanges}
                    className="btn btn-secondary"
                    disabled={!profileChanged || savingProfile}
                  >
                    Discard changes
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!profileChanged || savingProfile || loading}>
                    {savingProfile ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
          </section>

          <SecurityCard security={account?.security ?? null} loading={loading} onNotify={showToastMessage} />

          <PerformanceCard />
          </div>

          <div className="settings-side">
          <AppearanceCard />

          <FormatsCard />

          <DataCard onNotify={showToastMessage} />

          <section aria-label="Account management" className="card settings-card">
              <h2 className="dashboard-section-title settings-card-title">Account management</h2>
              <div className="settings-buttons">
                <button type="button" onClick={handleLogout} className="btn btn-secondary">
                  Logout
                </button>
                <button type="button" onClick={() => setShowDeleteModal(true)} className="btn btn-danger">
                  Delete Account
                </button>
              </div>
          </section>
          </div>

          <section aria-label="Help and contact information" className="card settings-card settings-help">
              <h2 className="dashboard-section-title settings-card-title">Help & Contact</h2>
              <div className="settings-help-grid">
                <div className="settings-link-card">
                  <div>
                    <h3>Help</h3>
                    <p className="text-muted">Guides, tutorials and answers to common questions.</p>
                  </div>
                  <Link href="/help" className="btn btn-secondary">
                    View Help
                  </Link>
                </div>

                <div className="settings-link-card">
                  <div>
                    <h3>Contact Us</h3>
                    <p className="text-muted">Send the team a message when you need a hand.</p>
                  </div>
                  <Link href="/contact" className="btn btn-secondary">
                    Contact
                  </Link>
                </div>
              </div>
          </section>
          </div>

          {showDeleteModal && (
            <dialog
              ref={deleteDialogRef}
              className="modal"
              aria-label="Delete Account"
              style={{ maxWidth: "500px", width: "100%" }}
              onClose={() => setShowDeleteModal(false)}
            >
              <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
                <h2 style={{ color: "var(--brand-danger)", marginBottom: "var(--space-2)" }}>
                  Delete Account
                </h2>
                <p className="text-muted">
                  You will be logged out and lose access straight away. Your data is kept for now.
                </p>
                <p className="text-muted" style={{ marginTop: "var(--space-2)" }}>
                  Changed your mind later? Log in with the same email and password and choose Recover account.
                </p>
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </dialog>
          )}

          {toastMessage && (
            <div className="settings-toast" role="status" aria-live="polite">
              {toastMessage}
            </div>
          )}
    </div>
  );
}