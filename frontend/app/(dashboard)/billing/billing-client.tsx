"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useBuildings } from "@/lib/useBuildings";
import { PageHeading } from "@/components/PageHeading";
import { FormAlert } from "@/components/FormAlert";

const SEASONS = ["Summer", "Winter"] as const;

type FormData = {
  building_id: string;
  season_name: string;
  peak_rate: string;
  off_peak_rate: string;
};

const initial: FormData = {
  building_id: "",
  season_name: "Summer",
  peak_rate: "",
  off_peak_rate: "",
};

const errorStyle: React.CSSProperties = {
  borderColor: "var(--brand-danger)",
  boxShadow:
    "0 0 0 2px var(--brand-bg), 0 0 0 4px var(--brand-danger)",
};

function parseRate(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function BillingClient() {
  const [form, setForm] = useState<FormData>(initial);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [apiError, setApiError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    data: buildings = [],
    isLoading: buildingsLoading,
    isError: buildingsError,
  } = useBuildings();

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === form.building_id),
    [buildings, form.building_id]
  );

  const peakValue = parseRate(form.peak_rate);
  const offPeakValue = parseRate(form.off_peak_rate);

  const savingsPercent = useMemo(() => {
    if (
      peakValue === null ||
      offPeakValue === null ||
      peakValue <= 0 ||
      offPeakValue < 0 ||
      offPeakValue > peakValue
    ) {
      return null;
    }
    return Math.round(((peakValue - offPeakValue) / peakValue) * 100);
  }, [peakValue, offPeakValue]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setErrors((p) => ({ ...p, [name]: "" }));
    if (apiError) setApiError("");
    if (saved) setSaved("");
  };

  const validate = (): boolean => {
    const next: Partial<FormData> = {};

    if (!form.building_id) {
      next.building_id = "Select the building these rates apply to.";
    }
    if (!form.season_name) {
      next.season_name = "Season is required.";
    }

    const peak = parseRate(form.peak_rate);
    if (peak === null) next.peak_rate = "Peak rate is required.";
    else if (peak < 0) next.peak_rate = "Peak rate cannot be negative.";

    const offPeak = parseRate(form.off_peak_rate);
    if (offPeak === null) next.off_peak_rate = "Off-peak rate is required.";
    else if (offPeak < 0)
      next.off_peak_rate = "Off-peak rate cannot be negative.";

    if (
      peak !== null &&
      offPeak !== null &&
      peak >= 0 &&
      offPeak >= 0 &&
      offPeak > peak
    ) {
      next.off_peak_rate =
        "Off-peak rate should not be higher than the peak rate.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError("");
    setSaved("");

    try {
      const res = await fetch(
        `/api/buildings/${form.building_id}/tariffs`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            season_name: form.season_name,
            peak_rate_zar: Number(form.peak_rate),
            off_peak_rate_zar: Number(form.off_peak_rate),
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.message ?? "Failed to update the tariff rates."
        );
      }
      setSaved(data?.message ?? "Tariff rates updated successfully.");
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Failed to update the tariff rates."
      );
    } finally {
      setLoading(false);
    }
  };

  const isFormDisabled = loading || buildingsLoading;

  return (
    <div>
      <PageHeading
        title="Update tariff rates"
        subtitle="Set the seasonal time-of-use rates used to cost energy usage and size the optimisation savings."
      />

      <div
        className="billing-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "var(--space-5)",
          alignItems: "start",
          maxWidth: 1100,
        }}
      >
        
        <form
          onSubmit={handleSubmit}
          noValidate
          className="card"
          style={{ display: "grid", gap: "var(--space-5)" }}
        >
          
          <fieldset
            style={{
              border: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: "var(--space-4)",
            }}
          >
            <legend
              style={{
                fontSize: "0.7rem",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--brand-ink-muted)",
                marginBottom: "var(--space-2)",
              }}
            >
              Scope
            </legend>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <label className="label" htmlFor="building_id">
                Building <span aria-hidden>*</span>
              </label>
              <select
                id="building_id"
                name="building_id"
                className="select"
                value={form.building_id}
                onChange={handleChange}
                disabled={isFormDisabled || buildings.length === 0}
                style={errors.building_id ? errorStyle : undefined}
                aria-invalid={Boolean(errors.building_id)}
                aria-describedby={
                  errors.building_id ? "building_id-error" : undefined
                }
              >
                <option value="">
                  {buildingsLoading
                    ? "Loading buildings…"
                    : "Select building"}
                </option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
              {errors.building_id && (
                <p
                  id="building_id-error"
                  role="alert"
                  style={{
                    color: "var(--brand-danger)",
                    fontSize: "var(--fs-small)",
                    margin: 0,
                  }}
                >
                  {errors.building_id}
                </p>
              )}
              {buildingsError && (
                <p
                  role="alert"
                  style={{
                    color: "var(--brand-danger)",
                    fontSize: "var(--fs-small)",
                    margin: 0,
                  }}
                >
                  Unable to load your buildings right now.
                </p>
              )}
              {!buildingsLoading &&
                !buildingsError &&
                buildings.length === 0 && (
                  <p
                    className="text-muted"
                    style={{ fontSize: "var(--fs-small)", margin: 0 }}
                  >
                    No buildings are currently assigned to your account.
                  </p>
                )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <label className="label" htmlFor="season_name">
                Season <span aria-hidden>*</span>
              </label>
              <select
                id="season_name"
                name="season_name"
                className="select"
                value={form.season_name}
                onChange={handleChange}
                disabled={isFormDisabled}
              >
                {SEASONS.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          
          <fieldset
            style={{
              border: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: "var(--space-4)",
              paddingTop: "var(--space-4)",
              borderTop: "1px solid var(--brand-border)",
            }}
          >
            <legend
              style={{
                fontSize: "0.7rem",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--brand-ink-muted)",
                paddingTop: "var(--space-2)",
              }}
            >
              Time-of-use rates
            </legend>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              <RateField
                id="peak_rate"
                label="Peak rate"
                suffix="R/kWh"
                value={form.peak_rate}
                onChange={handleChange}
                error={errors.peak_rate}
                disabled={isFormDisabled}
                placeholder="0.33"
                accent="var(--brand-primary)"
              />
              <RateField
                id="off_peak_rate"
                label="Off-peak rate"
                suffix="R/kWh"
                value={form.off_peak_rate}
                onChange={handleChange}
                error={errors.off_peak_rate}
                disabled={isFormDisabled}
                placeholder="0.22"
                accent="var(--brand-secondary)"
              />
            </div>
          </fieldset>

          <p
            className="text-muted"
            style={{
              fontSize: "var(--fs-small)",
              margin: 0,
              paddingTop: "var(--space-3)",
              borderTop: "1px solid var(--brand-border)",
            }}
          >
            New rates apply to optimisation savings calculated from here on,
            existing recommendations keep the figures they were generated
            with.
          </p>

          {apiError && <FormAlert message={apiError} />}

          {saved && (
            <output
              style={{
                color: "var(--badge-success-text)",
                padding: "var(--space-3) var(--space-4)",
                border:
                  "1px solid color-mix(in srgb, var(--brand-success) 35%, transparent)",
                background:
                  "color-mix(in srgb, var(--brand-success) 12%, transparent)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--fs-small)",
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
              }}
            >
              <span aria-hidden>✓</span>
              {saved}
            </output>
          )}

          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              justifyContent: "flex-end",
              paddingTop: "var(--space-3)",
              borderTop: "1px solid var(--brand-border)",
            }}
          >
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? "Saving…" : "Save rates"}
            </button>
          </div>
        </form>

        
        <aside
          style={{
            display: "grid",
            gap: "var(--space-4)",
            position: "sticky",
            top: "var(--space-5)",
          }}
        >
          {/* Live preview */}
          <section className="card" aria-label="Rate preview">
            <h2
              className="dashboard-section-title"
              style={{ marginBottom: "var(--space-1)" }}
            >
              Preview
            </h2>
            <p
              className="dashboard-section-meta"
              style={{ marginBottom: "var(--space-4)" }}
            >
              {selectedBuilding
                ? `${selectedBuilding.name} · ${form.season_name}`
                : "Select a building to preview"}
            </p>

            <RatePreview
              peak={peakValue}
              offPeak={offPeakValue}
              savingsPercent={savingsPercent}
            />
          </section>

          
          <section
            className="card"
            aria-label="How rates are used"
            style={{
              background: "var(--brand-surface-alt)",
              border: "1px solid var(--brand-border)",
            }}
          >
            <h2
              className="dashboard-section-title"
              style={{ marginBottom: "var(--space-3)" }}
            >
              How we use these rates
            </h2>
            <ul
              style={{
                margin: 0,
                paddingLeft: "var(--space-5)",
                display: "grid",
                gap: "var(--space-2)",
                fontSize: "var(--fs-small)",
                color: "var(--brand-ink-muted)",
                lineHeight: 1.6,
              }}
            >
              <li>Cost every kWh the building consumes per tariff window.</li>
              <li>
                Size the rand savings the optimiser reports back to you.
              </li>
              <li>
                Rank recommendations — the bigger the peak-to-off-peak spread,
                the more shifting load pays off.
              </li>
            </ul>
          </section>
        </aside>
      </div>

      
      
    </div>
  );
}


function RateField({
  id,
  label,
  suffix,
  value,
  onChange,
  error,
  disabled,
  placeholder,
  accent,
}: {
  id: string;
  label: string;
  suffix: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  disabled: boolean;
  placeholder: string;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <label className="label" htmlFor={id}>
        {label} <span aria-hidden>*</span>
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          name={id}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          className="input"
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{
            paddingRight: 64,
            ...(error ? errorStyle : undefined),
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "var(--fs-small)",
            color: accent,
            fontWeight: "var(--fw-semibold)",
            fontFamily: "var(--font-mono)",
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          style={{
            color: "var(--brand-danger)",
            fontSize: "var(--fs-small)",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function RatePreview({
  peak,
  offPeak,
  savingsPercent,
}: {
  peak: number | null;
  offPeak: number | null;
  savingsPercent: number | null;
}) {
  if (peak === null && offPeak === null) {
    return (
      <p
        className="text-muted"
        style={{
          fontSize: "var(--fs-small)",
          margin: 0,
          padding: "var(--space-4)",
          textAlign: "center",
          border: "1px dashed var(--brand-border)",
          borderRadius: "var(--radius-md)",
        }}
      >
        Enter both rates to see a preview.
      </p>
    );
  }

  const max = Math.max(peak ?? 0, offPeak ?? 0, 0.01);
  const peakPct = peak !== null ? Math.round((peak / max) * 100) : 0;
  const offPeakPct =
    offPeak !== null ? Math.round((offPeak / max) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      <PreviewRow
        label="Peak"
        value={peak}
        percent={peakPct}
        color="var(--brand-primary)"
      />
      <PreviewRow
        label="Off-peak"
        value={offPeak}
        percent={offPeakPct}
        color="var(--brand-secondary)"
      />

      <div
        style={{
          marginTop: "var(--space-2)",
          paddingTop: "var(--space-3)",
          borderTop: "1px solid var(--brand-border)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span
          className="dashboard-section-meta"
          style={{ fontSize: "var(--fs-small)" }}
        >
          Off-peak savings
        </span>
        <span
          className="metric"
          style={{
            fontSize: "1.05rem",
            fontWeight: "var(--fw-semibold)",
            color:
              savingsPercent === null
                ? "var(--brand-ink-muted)"
                : "var(--brand-success)",
          }}
        >
          {savingsPercent === null ? "—" : `${savingsPercent}%`}
        </span>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: number | null;
  percent: number;
  color: string;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: "var(--fw-medium)",
            color: "var(--brand-ink)",
          }}
        >
          {label}
        </span>
        <span
          className="metric"
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: "var(--fw-semibold)",
            color: "var(--brand-ink-muted)",
          }}
        >
          {value === null ? "—" : `R ${value.toFixed(4)}`}
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 8,
          borderRadius: 999,
          background:
            "color-mix(in srgb, var(--brand-secondary) 18%, transparent)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: `${percent}%`,
            background: color,
            borderRadius: 999,
            transition: "width 0.25s ease",
          }}
        />
      </div>
    </div>
  );
}