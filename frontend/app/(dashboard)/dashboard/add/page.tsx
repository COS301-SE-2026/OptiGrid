"use client";

import { useState, useEffect } from "react";

export default function AddBuildingPage() {
  const buildingTypes = ["Office", "Residential", "Industrial"];

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");

  useEffect(() => {
    const inter = document.createElement("link");
    inter.rel = "stylesheet";
    inter.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(inter);

    const spaceGrotesk = document.createElement("link");
    spaceGrotesk.rel = "stylesheet";
    spaceGrotesk.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap";
    document.head.appendChild(spaceGrotesk);

    const jetbrains = document.createElement("link");
    jetbrains.rel = "stylesheet";
    jetbrains.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(jetbrains);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const data = {
      building_name: formData.get("building_name"),
      physical_address: formData.get("physical_address"),
      building_type: formData.get("building_type"),
      operatingHours: {
        start: startTime,
        end: endTime,
      },
      square_footage: formData.get("square_footage"),
      max_occupancy: formData.get("max_occupancy"),
    };

    console.log("Building Data:", data);
    alert("Building created successfully");

    e.currentTarget.reset();
    setStartTime("08:00");
    setEndTime("18:00");
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="dashboard-main" style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          
          
          <div className="card" style={{ padding: "var(--space-6)" }}>
            
            
            <div style={{ marginBottom: "var(--space-6)" }}>
              <h1>Create Building</h1>
              <div className="text-muted" style={{ marginTop: "var(--space-2)" }}>
                Add a new building
              </div>
            </div>

            
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                
                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label">
                    Building Name <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="building_name"
                    required
                    className="input"
                    placeholder="e.g., building A"
                  />
                </div>

                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label">
                    Physical Address <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <textarea
                    name="physical_address"
                    rows={3}
                    required
                    className="input"
                    style={{ resize: "vertical" }}
                    placeholder="Enter the address"
                  />
                </div>

         
                <div>
                  <label className="label">
                    Building Type <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <select
                    name="building_type"
                    required
                    className="select"
                    defaultValue=""
                  >
                    <option value="" disabled>Select building type</option>
                    {buildingTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

         
                <div>
                  <label className="label">
                    Square Footage  <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="square_footage"
                    required
                    className="input"
                    placeholder="e.g., 2500"
                  />
                </div>

         
                <div>
                  <label className="label">
                    Max Occupancy <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="max_occupancy"
                    required
                    className="input"
                    placeholder="e.g., 120"
                  />
                </div>

         
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label">
                    Operating Hours <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                </div>

         
                <div>
                  <label className="label" style={{ fontSize: "var(--fs-small)" }}>
                    Start Time
                  </label>
                  <input
                    type="text"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input"
                    placeholder="08:00"
                    required
                  />
                </div>

         
                <div>
                  <label className="label" style={{ fontSize: "var(--fs-small)" }}>
                    End Time
                  </label>
                  <input
                    type="text"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input"
                    placeholder="18:00"
                    required
                  />
                </div>

         
                <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => window.history.back()}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="btn btn-primary"
                  >
                    Create Building
                  </button>
                </div>

              </div>
            </form>
          </div>

         
        </div>
      </div>
    </div>
  );
}