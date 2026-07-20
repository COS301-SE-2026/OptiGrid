"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../theme-provider";

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "manager" | "user";
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
  const {theme,toggle} = useTheme();

  const [profile, setProfile] = useState<UserProfile>({
    first_name: "Tali",
    last_name: "Seaba",
    email: "Tali@example.com",
    role: "admin",
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>("");

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSaveChanges = () => {
    setIsEditing(false);
    showToastMessage("Profile changes saved");
  };

  const handleResetToDefault = () => {
    setProfile({
      first_name: "Tali",
      last_name: "Seaba",
      email: "Tali@example.com",
      role: "admin",
    });
    setIsEditing(false);
    showToastMessage("Profile reset to default");
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      showToastMessage("Logged out");
      setTimeout(() => {
        router.push("/login");
      }, 500);
    }
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmText !== "DELETE") {
      showToastMessage('Please type "DELETE" to confirm');
      return;
    }
    setShowDeleteModal(false);
    setDeleteConfirmText("");
    showToastMessage("Account deleted");
    setTimeout(() => {
      router.push("/login");
    }, 500);
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

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <div className="dashboard-main">
          <div className="dashboard-header">
            <div>
              <h1 className="dashboard-title">Settings</h1>
              <div className="dashboard-subtitle">Manage your profile and account settings</div>
            </div>
            <div className="badge badge-success" style={{ display: "inline-flex" }}>
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </div>
          </div>

          <div className="card" style={{ marginBottom: "var(--space-5)" }}>
            <h2 style={{ marginBottom: "var(--space-4)" }}>Profile Information</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label className="label">First Name</label>
                <input
                  type="text"
                  value={profile.first_name}
                  onChange={(e) => {
                    setProfile({ ...profile, first_name: e.target.value });
                    setIsEditing(true);
                  }}
                  className="input"
                  placeholder="Enter first name"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label className="label">Last Name</label>
                <input
                  type="text"
                  value={profile.last_name}
                  onChange={(e) => {
                    setProfile({ ...profile, last_name: e.target.value });
                    setIsEditing(true);
                  }}
                  className="input"
                  placeholder="Enter last name"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label className="label">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => {
                    setProfile({ ...profile, email: e.target.value });
                    setIsEditing(true);
                  }}
                  className="input"
                  placeholder="Enter email address"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <label className="label">Role</label>
                <input
                  type="text"
                  value={profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  className="input"
                  disabled
                  style={{
                    backgroundColor: "var(--brand-surface-alt)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                marginTop: "var(--space-5)",
                paddingTop: "var(--space-4)",
                borderTop: "1px solid var(--brand-border)",
              }}
            >
              <button onClick={handleSaveChanges} className="btn btn-primary">
                Save Changes
              </button>
              <button onClick={handleResetToDefault} className="btn btn-secondary">
                Reset to Default
              </button>
            </div>
          </div>


                    <div className="card" style={{ marginBottom: "var(--space-5)" }}>
            <h2 style={{ marginBottom: "var(--space-4)" }}>Appearance</h2>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3)",
                backgroundColor: "var(--brand-surface-alt)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                {theme === "light" ? <SunIcon /> : <MoonIcon />}
                <span style={{ fontWeight: "var(--fw-medium)" }}>
                  {theme === "light" ? "Light Mode" : "Dark Mode"}
                </span>
              </div>
              <button
                onClick={handleThemeToggle}
                className="btn btn-primary"
                style={{ padding: "6px 16px", fontSize: "var(--fs-small)" }}
              >
                Switch to {theme === "light" ? "Dark" : "Light"} Mode
              </button>
            </div>
          </div>




          <div className="card" style={{ marginBottom: "var(--space-5)" }}>
            <h2 style={{ marginBottom: "var(--space-4)" }}>Help & Contact</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-4)",
              }}
            >
              <div
                className="card"
                style={{
                  padding: "var(--space-4)",
                  backgroundColor: "var(--brand-surface-alt)",
                }}
              >
                <h3 style={{ marginBottom: "var(--space-2)" }}>Help</h3>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Get help with using the platform and FAQs.
                </p>
                <Link href="/help" className="btn btn-primary" style={{ display: "inline-flex" }}>
                  View Help
                </Link>
              </div>

              <div
                className="card"
                style={{
                  padding: "var(--space-4)",
                  backgroundColor: "var(--brand-surface-alt)",
                }}
              >
                <h3 style={{ marginBottom: "var(--space-2)" }}>Contact Us</h3>
                <p className="text-muted" style={{ marginBottom: "var(--space-3)" }}>
                  Get in touch with for assistance.
                </p>
                <Link href="/contact" className="btn btn-primary" style={{ display: "inline-flex" }}>
                  Contact
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: "var(--space-4)" }}>Account Management</h2>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
              }}
            >
              <button
                onClick={handleLogout}
                className="btn"
                style={{
                  backgroundColor: "var(--brand-warning)",
                  color: "white",
                  padding: "6px 16px",
                  fontSize: "var(--fs-small)",
                }}
              >
                Logout
              </button>

              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn btn-danger"
                style={{
                  padding: "6px 16px",
                  fontSize: "var(--fs-small)",
                }}
              >
                Delete Account
              </button>
            </div>
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
                  setDeleteConfirmText("");
                }
              }}
            >
              <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
                <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
                  <h2 style={{ color: "var(--brand-danger)", marginBottom: "var(--space-2)" }}>
                    Delete Account
                  </h2>
                  <p className="text-muted">
                    All your data will be permanently deleted.
                  </p>
                </div>

                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label className="label">
                    Type <span style={{ color: "var(--brand-danger)", fontWeight: "bold" }}>DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE here..."
                    className="input"
                    style={
                      deleteConfirmText && deleteConfirmText !== "DELETE"
                        ? { borderColor: "var(--brand-danger)" }
                        : {}
                    }
                  />
                </div>

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteConfirmText("");
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="btn btn-danger"
                    style={{ flex: 1 }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {showToast && (
            <div
              style={{
                position: "fixed",
                bottom: "var(--space-4)",
                backgroundColor: "var(--brand-ink)",
                color: "var(--brand-bg)",
                padding: "var(--space-3) var(--space-5)",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-body)",
                fontSize: "var(--fs-body)",
              }}
            >
              {toastMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}