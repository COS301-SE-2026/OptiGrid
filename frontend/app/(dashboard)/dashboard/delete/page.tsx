"use client";

import { useEffect, useState } from "react";

export default function DeleteBuildingPage() {
  useEffect(() => {
    const inter = document.createElement("link");
    inter.rel = "stylesheet";
    inter.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(inter);

    const space = document.createElement("link");
    space.rel = "stylesheet";
    space.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(space);

    const jetbrains = document.createElement("link");
    jetbrains.rel = "stylesheet";
    jetbrains.href =
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(jetbrains);
  }, []);

  const building_name = "Sandton HQ";

  const [confirmation, setConfirmation] = useState("");

  const isMatch = confirmation === building_name;

  const handleDelete = () => {
    if (!isMatch) return;
    alert("Building permanently deleted");
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="dashboard-main" style={{ maxWidth: "600px", margin: "0 auto", width: "100%" }}>
          
          
          <div className="card" style={{ padding: "var(--space-6)" }}>
            
           
            <div style={{ marginBottom: "var(--space-5)" }}>
              <h1 style={{ color: "var(--brand-danger)" }}>
                Delete Building
              </h1>
              
              <div style={{ marginTop: "var(--space-3)" }}>
                <p className="text-muted" style={{ marginBottom: "var(--space-2)" }}>
                  This permanently removes the building and all of its historical energy data.
                </p>
                <p className="text-muted">
                  This action <strong>cannot be undone</strong>.
                </p>
              </div>
            </div>

            
            <div style={{ marginBottom: "var(--space-6)" }}>
              <label className="label">
                Type <strong>{building_name}</strong> to confirm
              </label>
              
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="input"
                placeholder={`Enter "${building_name}" to confirm deletion`}
                style={{ fontSize: "var(--fs-body)" }}
              />
              
              {confirmation && !isMatch && (
                <div 
                  className="badge badge-danger" 
                  style={{ marginTop: "var(--space-2)", display: "inline-flex" }}
                >
                  Building name does not match
                </div>
              )}
              
              {isMatch && (
                <div 
                  className="badge badge-warning" 
                  style={{ marginTop: "var(--space-2)", display: "inline-flex" }}
                >
                   Ready to delete
                </div>
              )}
            </div>

      
            <div className="dashboard-actions">
              <button
                type="button"
                className="btn btn-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!isMatch}
                onClick={handleDelete}
                className={`btn ${isMatch ? "btn-danger" : "btn-secondary"}`}
                style={!isMatch ? { opacity: 0.5, cursor: "not-allowed" } : {}}
              >
                Delete Permanently
              </button>
            </div>

          </div>

       
          <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
            <div className="badge badge-warning" style={{ display: "inline-flex" }}>
             This action is irreversible
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}