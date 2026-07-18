"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type SensorStatus = "Active" | "Offline" | "Maintenance";
type BuildingRecord = {
    building_id: string;
    building_name: string;
};

type BuildingResponse = {
    data?: BuildingRecord[];
    message?: string;
};

type SensorRecord = {
    sensor_id: string;
    building_id: string;
    mac_address: string;
    sensor_type: string;
    unit: string;
    location_zone: string;
    status: SensorStatus;
    installed_date: string;
};

const statusBadge: Record<SensorStatus, string> = {
    Active: "badge-success",
    Offline: "badge-danger",
    Maintenance: "badge-warning",
};

const MAC_PATTERN = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
//the sensor CRUD is not available in the core API yet so i will seed demo sensors for the building and keep them in client state until the endpoints are coded
function seedSensors(buildingId: string): SensorRecord[] {
    return [
        {
            sensor_id: `seed-${buildingId}-1`,
            building_id: buildingId,
            mac_address: "AA:BB:CC:00:00:01",
            sensor_type: "Energy meter",
            unit: "kWh",
            location_zone: "Main incomer",
            status: "Active",
            installed_date: "2026-02-15",
        },
        {
            sensor_id: `seed-${buildingId}-2`,
            building_id: buildingId,
            mac_address: "AA:BB:CC:00:00:02",
            sensor_type: "HVAC meter",
            unit: "kWh",
            location_zone: "Roof plant room",
            status: "Maintenance",
            installed_date: "2026-05-07",
        },
    ];
}

export default function SensorsClient({
    role,
    buildingId,
}: Readonly<{
    role: string;
    buildingId: string;
}>) {
    const canManageSensors = role === "ADMIN" || role === "BUILDING_MANAGER";

    const [building, setBuilding] = useState<BuildingRecord | null>(null);
    const [sensors, setSensors] = useState<SensorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [viewingSensor, setViewingSensor] = useState<SensorRecord | null>(null);
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [formError, setFormError] = useState("");
    const [form, setForm] = useState({
        mac_address: "",
        sensor_type: "",
        unit: "kWh",
        location_zone: "",
        status: "Active" as SensorStatus,
    });

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const response = await fetch("/api/buildings", { method: "GET", cache: "no-store" });
                const payload = (await response.json()) as BuildingResponse;

                if (!response.ok) {
                    throw new Error(payload.message || "Unable to load the building.");
                }
                const foundBuilding = (payload.data ?? []).find((row) => row.building_id === buildingId);
                if (!foundBuilding) {
                    throw new Error("Building not found.");
                }

                if (isMounted) {
                    setBuilding(foundBuilding);
                    setSensors(seedSensors(buildingId));
                }
            }
            catch (loadError) {
                if (isMounted) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : "Unable to load the building.",
                    );
                }
            }
            finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => {
            isMounted = false;
        };
    }, [buildingId]);

    const openRegisterModal = () => {
        setForm({
            mac_address: "",
            sensor_type: "",
            unit: "kWh",
            location_zone: "",
            status: "Active",
        });
        setFormError("");

        setIsRegisterOpen(true);
    };

    const handleRegisterSensor = () => {
        const macAddress = form.mac_address.trim().toUpperCase();

        if (!macAddress) {
            setFormError("MAC address is required");
            return;
        }

        if (!MAC_PATTERN.test(macAddress)) {
            setFormError("MAC address must look like AA:BB:CC:DD:EE:FF");
            return;
        }
        if (sensors.some((sensor) => sensor.mac_address.toUpperCase() === macAddress)) {
            setFormError("A sensor with this MAC address is already registered");
            return;
        }

        // every sensor registered here belongs to this building only 
        const newSensor: SensorRecord = {
            sensor_id: `sensor-${Date.now()}`,
            building_id: buildingId,
            mac_address: macAddress,
            sensor_type: form.sensor_type.trim() || "Energy meter",
            unit: form.unit.trim() || "kWh",
            location_zone: form.location_zone.trim(),
            status: form.status,
            installed_date: new Date().toISOString().slice(0, 10),
        };

        setSensors((prev) => [...prev, newSensor]);
        setIsRegisterOpen(false);
    };

    const handleDeleteSensor = (sensorId: string) => {
        if (!confirm("Delete this sensor permanently?")) return;
        setSensors((prev) => prev.filter((sensor) => sensor.sensor_id !== sensorId));
    };

    return (
        <section>
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">
                        {building ? `${building.building_name} - Sensors` : "Sensors"}
                    </h1>
                    <div className="dashboard-subtitle">
                        {building
                            ? `${sensors.length} sensor${sensors.length === 1 ? "" : "s"} registered`
                            : "Sensors registered for this building"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                    <Link href={`/buildings/${buildingId}/view`} className="btn btn-secondary">Back to building</Link>
                    {canManageSensors && (
                        <button onClick={openRegisterModal} className="btn btn-primary" disabled={!building}>Register sensor</button>
                    )}
                </div>
            </div>

            {error && (
                <div className="card" role="alert"
                    style={{ marginBottom: "var(--space-5)", color: "var(--brand-danger)" }}>
                    {error}
                </div>
            )}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ overflow: "auto" }}>
                    <table className="dashboard-table">

                        <thead>
                            <tr>
                                <th>MAC address</th>
                                <th>Type</th>
                                <th>Zone</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="dashboard-empty"> Loading sensors... </td>
                                </tr>
                            ) : sensors.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="dashboard-empty">
                                        No sensors registered for this building
                                    </td>
                                </tr>
                            ) : (
                                sensors.map((sensor) => (
                                    <tr key={sensor.sensor_id}>
                                        <td style={{ fontWeight: "var(--fw-semibold)" }}>
                                            {sensor.mac_address}
                                        </td>

                                        <td>{sensor.sensor_type || "N/A"}</td>
                                        <td>{sensor.location_zone || "N/A"}</td>
                                        <td>
                                            <span className={`badge ${statusBadge[sensor.status]}`}>
                                                {sensor.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                                                <button
                                                    onClick={() => setViewingSensor(sensor)}
                                                    className="btn btn-secondary"
                                                    style={{ fontSize: "var(--fs-small)", padding: "4px 12px" }}>
                                                    View
                                                </button>
                                                {canManageSensors && (
                                                    <button
                                                        onClick={() => handleDeleteSensor(sensor.sensor_id)}
                                                        className="btn btn-danger"
                                                        style={{ padding: "4px 12px", fontSize: "var(--fs-small)"  }}>
                                                        Delete
                                                    </button>
                                                )}
                                            </div>

                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {viewingSensor && (
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
                        if (e.target === e.currentTarget) setViewingSensor(null);
                    }}
                >
                    <div className="modal" style={{ width: "100%", maxWidth: "500px" }}>
                        <h2 style={{ marginBottom: "var(--space-4)" }}>Sensor details</h2>
                        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-2) var(--space-4)" }}>
                            <dt className="label">Building</dt>
                            <dd>{building?.building_name ?? "Unknown building"}</dd>
                            <dt className="label">MAC address</dt>
                            <dd>{viewingSensor.mac_address}</dd>
                            <dt className="label">Type</dt>
                            <dd>{viewingSensor.sensor_type || "N/A"}</dd>
                            <dt className="label">Unit</dt>
                            <dd>{viewingSensor.unit || "N/A"}</dd>
                            <dt className="label">Zone</dt>
                            <dd>{viewingSensor.location_zone || "N/A"}</dd>
                            <dt className="label">Status</dt>
                            <dd>
                                <span className={`badge ${statusBadge[viewingSensor.status]}`}>
                                    {viewingSensor.status}
                                </span>
                            </dd>
                            <dt className="label">Installed</dt>
                            <dd>{viewingSensor.installed_date || "N/A"}</dd>
                        </dl>
                        <div style={{ display: "flex", marginTop: "var(--space-5)" }}>
                            <button type="button" onClick={() => setViewingSensor(null)} style={{ flex: 1 }} className="btn btn-secondary">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {isRegisterOpen && (
                <div
                    className="modal-overlay"
                    style={{
                        position: "fixed",
                        justifyContent: "center",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        padding: "var(--space-4)",
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsRegisterOpen(false);
                    }}
                >
                    <div className="modal" style={{ maxWidth: "500px", width: "100%" }}>
                        <h2 style={{ marginBottom: "var(--space-4)" }}>Register sensor</h2>
                        <p style={{ fontSize: "var(--fs-small)", marginBottom: "var(--space-4)" }}>
                            The sensor will be registered to {building?.building_name ?? "this building"}.
                        </p>

                        <div style={{ gap: "var(--space-4)", display: "grid" }}>
                            <div>
                                <label className="label" htmlFor="sensor-mac">MAC address</label>
                                <input
                                    id="sensor-mac"
                                    type="text"
                                    value={form.mac_address}
                                    onChange={(e) => setForm((prev) => ({ ...prev, mac_address: e.target.value }))}
                                    className="input"
                                    style={formError ? { borderColor: "var(--brand-danger)" } : {}}
                                    placeholder="AA:BB:CC:DD:EE:FF"
                                />
                                {formError && (
                                    <p style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)", marginTop: "var(--space-1)" }}>
                                        {formError}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="label" htmlFor="sensor-type">Sensor type</label>
                                <input
                                    id="sensor-type"
                                    type="text"
                                    value={form.sensor_type}
                                    onChange={(e) => setForm((prev) => ({ ...prev, sensor_type: e.target.value }))}
                                    className="input"
                                    placeholder="Energy meter"
                                />
                            </div>
                            <div>
                                <label className="label" htmlFor="sensor-unit">Unit</label>
                                <input
                                    id="sensor-unit"
                                    type="text"
                                    value={form.unit}
                                    onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                                    className="input"
                                    placeholder="kWh"
                                />
                            </div>

                            <div>
                                <label className="label" htmlFor="sensor-zone">Location zone</label>
                                <input
                                    id="sensor-zone"
                                    type="text"
                                    value={form.location_zone}
                                    onChange={(e) => setForm((prev) => ({ ...prev, location_zone: e.target.value }))}
                                    className="input"
                                    placeholder="Main incomer"
                                />
                            </div>

                            <div>
                                <label className="label" htmlFor="sensor-status">Status</label>
                                <select
                                    id="sensor-status"
                                    value={form.status}
                                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as SensorStatus }))}
                                    className="select"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Offline">Offline</option>
                                    <option value="Maintenance">Maintenance</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-5)" }}>
                            <button type="button" onClick={() => setIsRegisterOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                                Cancel
                            </button>
                            <button type="button" onClick={handleRegisterSensor} className="btn btn-primary" style={{ flex: 1 }}>Register</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}