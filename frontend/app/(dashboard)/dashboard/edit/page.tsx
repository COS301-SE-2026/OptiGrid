"use client";

import { useState, useEffect } from "react";

export default function EditBuildingPage() {
  const buildingTypes = ["Residential", "Office", "Industrial"];

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

  const [formData, setFormData] = useState({
    building_name: "Building A",
    building_type: "Office",
    physical_address: "123 Street, Pretoria",
    square_footage: "2500",
    max_occupancy: "120",
    operating_start: "08:00",
    operating_end: "18:00",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = {
      building_name: formData.building_name,
      building_type: formData.building_type,
      physical_address: formData.physical_address,
      square_footage: formData.square_footage,
      max_occupancy: formData.max_occupancy,
      operating_hours: {
        start: formData.operating_start,
        end: formData.operating_end,
      },
    };

    console.log("Updated Building:", data);
    alert("Building updated successfully!");
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell" style={{ alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="dashboard-main" style={{ maxWidth: "800px", margin: "0 auto", width: "100%" }}>
          
          
          <div className="card" style={{ padding: "var(--space-6)" }}>
            
            
            <div style={{ marginBottom: "var(--space-6)" }}>
              <h1>Edit Building</h1>
              <div className="text-muted" style={{ marginTop: "var(--space-2)" }}>
                Update building information and operational details
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
                    value={formData.building_name}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                
                <div style={{ gridColumn: "1 / -1" }}>
                  <label className="label">
                    Physical Address <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <textarea
                    name="physical_address"
                    value={formData.physical_address}
                    onChange={handleChange}
                    rows={3}
                    className="input"
                    style={{ resize: "vertical" }}
                    required
                  />
                </div>

                
                <div>
                  <label className="label">
                    Building Type <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <select
                    name="building_type"
                    value={formData.building_type}
                    onChange={handleChange}
                    className="select"
                    required
                  >
                    {buildingTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                
                <div>
                  <label className="label">
                    Square Footage (m²) <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="square_footage"
                    value={formData.square_footage}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                
                <div>
                  <label className="label">
                    Max Occupancy <span style={{ color: "var(--brand-danger)" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="max_occupancy"
                    value={formData.max_occupancy}
                    onChange={handleChange}
                    className="input"
                    required
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
                    type="time"
                    name="operating_start"
                    value={formData.operating_start}
                    onChange={handleChange}
                    className="input"
                    required
                  />
                </div>

                
                <div>
                  <label className="label" style={{ fontSize: "var(--fs-small)" }}>
                    End Time
                  </label>
                  <input
                    type="time"
                    name="operating_end"
                    value={formData.operating_end}
                    onChange={handleChange}
                    className="input"
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
                    Save Changes
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