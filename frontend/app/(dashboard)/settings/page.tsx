"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "@/app/theme-provider";


interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "manager" | "user";
}

const EMPTY_PROFILE: UserProfile = {
  first_name: "",
  last_name: "",
  email: "",
  role: "user",
};

function roleFromSession(roleType: string): UserProfile["role"] {
  if (roleType === "ADMIN") {
    return "admin";
  }

  if (roleType === "BUILDING_MANAGER") {
    return "manager";
  }

  return "user";
}

function profileFromSession(user: Record<string, unknown>): UserProfile {
  const roleType = typeof user.roleType === "string" ? user.roleType : "VIEWER";

  return {
    first_name: typeof user.firstName === "string" ? user.firstName : "",
    last_name: typeof user.lastName === "string" ? user.lastName : "",
    email: typeof user.email === "string" ? user.email : "",
    role: roleFromSession(roleType),
  };
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [initialProfile, setInitialProfile] = useState<UserProfile>(EMPTY_PROFILE);

  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const user = (await response.json()) as Record<string, unknown>;
        const sessionProfile = profileFromSession(user);

        if (isMounted) {
          setProfile(sessionProfile);
          setInitialProfile(sessionProfile);
        }
      } catch (error) {
        console.error("Failed to load user profile", error);
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveChanges = () => {
    showToastMessage("Profile changes saved");
  };

  const handleResetToDefault = () => {
    setProfile(initialProfile);
    showToastMessage("Profile reset");
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

  const handleThemeToggle = async () => {
    toggle();
    const newTheme = theme === "light" ? "dark" : "light";
    try {
      await fetch("/api/preferences/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch (e) {
      console.error("Failed to sync theme to backend", e);
    }
  };

  const roleLabel = profile.role.charAt(0).toUpperCase() + profile.role.slice(1);

  return (
    <div className="settings-page">
          <div className="dashboard-header dashboard-page-heading">
            <div>
              <h1 className="dashboard-title">Settings</h1>
              <p className="dashboard-subtitle">Manage your profile and account settings.</p>
            </div>
            <span className="badge badge-default">{roleLabel}</span>
          </div>

          <div className="settings-grid">
          <section aria-label="Profile Information" className="card settings-card settings-profile">
              <h2 className="dashboard-section-title settings-card-title">Profile Information</h2>

              <div className="settings-fields">
                <div className="settings-field">
                  <label className="label" htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    type="text"
                    value={profile.first_name}
                    onChange={(e) => {
                      setProfile({ ...profile, first_name: e.target.value });
                    }}
                    className="input"
                    placeholder="Enter first name"
                  />
                </div>

                <div className="settings-field">
                  <label className="label" htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    type="text"
                    value={profile.last_name}
                    onChange={(e) => {
                      setProfile({ ...profile, last_name: e.target.value });
                    }}
                    className="input"
                    placeholder="Enter last name"
                  />
                </div>

                <div className="settings-field">
                  <label className="label" htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => {
                      setProfile({ ...profile, email: e.target.value });
                    }}
                    className="input"
                    placeholder="Enter email address"
                  />
                </div>

                <div className="settings-field">
                  <label className="label" htmlFor="role">Role</label>
                  <input id="role" type="text" value={roleLabel} className="input" disabled />
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" onClick={handleResetToDefault} className="btn btn-secondary">
                  Reset
                </button>
                <button type="button" onClick={handleSaveChanges} className="btn btn-primary">
                  Save Changes
                </button>
              </div>
          </section>

          <div className="settings-side">
          <section aria-label="Theme settings" className="card settings-card">
              <h2 className="dashboard-section-title settings-card-title">Theme</h2>
              <div className="settings-row">
                <div className="settings-row-label">
                  {theme === "light" ? <SunIcon /> : <MoonIcon />}
                  <span>{theme === "light" ? "Light Mode" : "Dark Mode"}</span>
                </div>
                <button type="button" onClick={handleThemeToggle} className="btn btn-secondary">
                  Switch to {theme === "light" ? "Dark" : "Light"} Mode
                </button>
              </div>
          </section>

          <section aria-label="Account management" className="card settings-card">
              <h2 className="dashboard-section-title settings-card-title">Account Management</h2>
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
            <div
              className="modal-overlay"
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-4)",
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowDeleteModal(false);
                }
              }}
              role="dialog"
              aria-modal="true"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowDeleteModal(false);
                }
              }}
            >
              <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
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
              </div>
              </div>
)}
 
          {showToast && (
            <div
              style={{
                backgroundColor: "var(--brand-ink)",
                color: "var(--brand-bg)",
                position: "fixed",
                right: "var(--space-5)",
                bottom: "var(--space-5)",
                zIndex: 60,
                padding: "var(--space-3) var(--space-5)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-card)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-body)"                
              }}
              role="alert"
            >
              {toastMessage}
            </div>
          )}
    </div>
  );
}