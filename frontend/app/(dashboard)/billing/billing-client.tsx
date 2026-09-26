"use client";

import { useState, type FormEvent } from "react";
import { useBuildings } from "@/lib/useBuildings";
import { PageHeading } from "@/components/PageHeading";
import { FormAlert } from "@/components/FormAlert";
import { CurvedSelect } from "@/components/curvedselect";

type RatesState = {
  Summer: { Peak: string; Standard: string; "Off-Peak": string };
  Winter: { Peak: string; Standard: string; "Off-Peak": string };
};

type Season = keyof RatesState;
type RatePeriod = keyof RatesState[Season];

const RATE_PERIODS: RatePeriod[] = ["Peak", "Standard", "Off-Peak"];

const initialRates: RatesState = {
  Summer: { Peak: "2.50", Standard: "1.50", "Off-Peak": "1.00" },
  Winter: { Peak: "3.50", Standard: "2.00", "Off-Peak": "1.50" },
};

const PERIOD_META: Record<
  RatePeriod,
  { blurb: string; colour: string }
> = {
  Peak: {
    blurb: "Highest demand windows",
    colour: "var(--brand-danger)",
  },
  Standard: {
    blurb: "Daytime baseline",
    colour: "var(--brand-primary)",
  },
  "Off-Peak": {
    blurb: "Overnight and weekends",
    colour: "var(--brand-success)",
  },
};

type SeasonRateCardProps = {
  season: Season;
  heading: string;
  accent: string;
  rates: RatesState[Season];
  onRateChange: (season: Season, period: RatePeriod, value: string) => void;
};

function SeasonRateCard({
  season,
  heading,
  accent,
  rates,
  onRateChange,
}: SeasonRateCardProps) {
  return (
    <section
      className="card"
      aria-labelledby={`season-${season}-heading`}
      style={{
        display: "grid",
        gap: "var(--space-4)",
        borderTop: `3px solid ${accent}`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "var(--space-3)",
        }}
      >
        <h3
          id={`season-${season}-heading`}
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontSize: "1rem",
            fontWeight: "var(--fw-semibold)",
            color: "var(--brand-ink)",
          }}
        >
          {heading}
        </h3>
        <span
          className="dashboard-section-meta"
          style={{ fontSize: "0.7rem", textTransform: "uppercase" }}
        >
          R
        </span>
      </header>

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {RATE_PERIODS.map((period) => {
          const meta = PERIOD_META[period];
          const inputId = `${season}-${period}-rate`.replace(/\s/g, "-");
          return (
            <div
              key={`${season}-${period}`}
              style={{
                display: "grid",
                gap: 6,
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                background: "var(--brand-surface-alt)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                }}
              >
                <label
                  htmlFor={inputId}
                  style={{
                    fontSize: "var(--fs-small)",
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--brand-ink)",
                  }}
                >
                  {period}
                </label>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      fontSize: "var(--fs-small)",
                      color: "var(--brand-ink-muted)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    R
                  </span>
                  <input
                    id={inputId}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    className="input"
                    value={rates[period]}
                    onChange={(e) =>
                      onRateChange(season, period, e.target.value)
                    }
                    style={{
                      width: 96,
                      padding: "6px 10px",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                </div>
              </div>
              <span
                className="dashboard-section-meta"
                style={{ fontSize: "0.7rem" }}
              >
                {meta.blurb}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const WEEKDAY_SCHEDULE = [
  { period: "Off-Peak", startHour: 0, endHour: 6 },
  { period: "Peak", startHour: 6, endHour: 9 },
  { period: "Standard", startHour: 9, endHour: 17 },
  { period: "Peak", startHour: 17, endHour: 19 },
  { period: "Standard", startHour: 19, endHour: 22 },
  { period: "Off-Peak", startHour: 22, endHour: 24 },
];

const PERIOD_BAR_COLOUR: Record<string, string> = {
  Peak: "var(--brand-danger)",
  Standard: "var(--brand-primary)",
  "Off-Peak": "var(--brand-success)",
};

function ScheduleBar() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: 32,
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        border: "1px solid var(--brand-border)",
      }}
      aria-hidden
    >
      {WEEKDAY_SCHEDULE.map((slot, i) => {
        const span = slot.endHour - slot.startHour;
        const pct = (span / 24) * 100;
        return (
          <div
            key={i}
            title={`${slot.period} - ${slot.startHour}:00-${slot.endHour}:00`}
            style={{
              width: `${pct}%`,
              background: PERIOD_BAR_COLOUR[slot.period],
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: "var(--fw-semibold)",
              color: "#FFFFFF",
              fontFamily: "var(--font-mono)",
            }}
          >
            {span >= 3 ? `${slot.startHour}-${slot.endHour}` : ""}
          </div>
        );
      })}
    </div>
  );
}

export default function BillingClient() {
  const [buildingId, setBuildingId] = useState<string>("");
  const [rates, setRates] = useState<RatesState>(initialRates);
  const [apiError, setApiError] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    data: buildings = [],
    isLoading: buildingsLoading,
    isError: buildingsError,
  } = useBuildings();

  const handleRateChange = (
    season: Season,
    period: RatePeriod,
    value: string
  ) => {
    setRates((prev) => ({
      ...prev,
      [season]: {
        ...prev[season],
        [period]: value,
      },
    }));
    setSaved("");
    setApiError("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!buildingId) {
      setApiError("Please select a building");
      return;
    }
    setLoading(true);
    setApiError("");
    setSaved("");

    const complexPayload = {
      type: "tou",
      seasons: [
        { name: "Summer", startMonth: 9, endMonth: 5 },
        { name: "Winter", startMonth: 6, endMonth: 8 },
      ],
      tou_schedule: {
        weekday: WEEKDAY_SCHEDULE,
        saturday: [
          { period: "Off-Peak", startHour: 0, endHour: 7 },
          { period: "Standard", startHour: 7, endHour: 12 },
          { period: "Off-Peak", startHour: 12, endHour: 18 },
          { period: "Standard", startHour: 18, endHour: 20 },
          { period: "Off-Peak", startHour: 20, endHour: 24 },
        ],
        sunday: [{ period: "Off-Peak", startHour: 0, endHour: 24 }],
      },
      blocks: [
        {
          max_kwh: null,
          rates: {
            Summer: {
              Peak: Number(rates.Summer.Peak),
              Standard: Number(rates.Summer.Standard),
              "Off-Peak": Number(rates.Summer["Off-Peak"]),
            },
            Winter: {
              Peak: Number(rates.Winter.Peak),
              Standard: Number(rates.Winter.Standard),
              "Off-Peak": Number(rates.Winter["Off-Peak"]),
            },
          },
        },
      ],
    };

    try {
      const res = await fetch(`/api/buildings/${buildingId}/tariffs`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(complexPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data?.message ?? "Failed to update the tariff rates");
      setSaved(data?.message ?? "Tariff rules updated successfully");
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Failed to update the tariff rates"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeading
        title="Utility Tariff Rates"
        subtitle="Configure Time-of-Use and seasonal rates based on the Eskom Megaflex schedule."
      />

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{ display: "grid", gap: "var(--space-5)", maxWidth: 1000 }}
      >
        <section className="card" aria-labelledby="target-heading">
          
            <div
    style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--space-4)",
      marginBottom: "var(--space-4)",
      flexWrap: "wrap",
    }}
  >
    <div>
          
          <h2
            id="target-heading"
            className="dashboard-section-title"
            style={{ marginBottom: "var(--space-1)" }}
          >
            Choose a building
          </h2>
          <p
            className="dashboard-section-meta"
            style={{ marginBottom: 0 }}
          >
            These tariff rules will apply only to the building you select.
          </p>
         </div>

             <button
      type="submit"
      form="tariff-form"
      disabled={loading}
      className="btn btn-primary"
    >
      {loading ? "Saving tariff…" : "Save tariff schedule"}
    </button>
  </div> 

          <div style={{ maxWidth: 400, display: "grid", gap: 6 }}>
            <label className="label" htmlFor="building_id">
              Building
            </label>
            <CurvedSelect
              id="building_id"
              value={buildingId}
              onChange={(value) => {
                setBuildingId(value);
                setApiError("");
                setSaved("");
              }}
              placeholder={
                buildingsLoading ? "Loading buildings…" : "Select building"
              }
              options={buildings.map((b) => ({
                value: b.id,
                label: b.name,
              }))}
              disabled={
                loading || buildingsLoading || buildings.length === 0
              }
            />
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
        </section>

        <section
          className="billing-seasons"
          aria-label="Seasonal rate configuration"
        >
          <SeasonRateCard
            season="Summer"
            heading="Summer"
            accent="var(--brand-warning)"
            rates={rates.Summer}
            onRateChange={handleRateChange}
          />
          <SeasonRateCard
            season="Winter"
            heading="Winter"
            accent="var(--brand-primary)"
            rates={rates.Winter}
            onRateChange={handleRateChange}
          />
        </section>

        <section className="card" aria-label="Weekday tariff schedule">
          <header
            className="dashboard-section-header"
            style={{ marginBottom: "var(--space-3)" }}
          >
            <h2 className="dashboard-section-title">
              Weekday schedule
            </h2>
            <span className="dashboard-section-meta">
              Standard TOU
            </span>
          </header>

          <ScheduleBar />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-4)",
              marginTop: "var(--space-4)",
              fontSize: "var(--fs-small)",
            }}
          >
            {RATE_PERIODS.map((period) => (
              <div
                key={period}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: PERIOD_BAR_COLOUR[period],
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontWeight: "var(--fw-semibold)",
                    color: "var(--brand-ink)",
                  }}
                >
                  {period}
                </span>
                <span className="text-muted">
                  {PERIOD_META[period].blurb}
                </span>
              </div>
            ))}
          </div>

          <p
            className="dashboard-section-meta"
            style={{
              margin: "var(--space-4) 0 0",
              paddingTop: "var(--space-3)",
              borderTop: "1px solid var(--brand-border)",
            }}
          >
            Peak windows are 06:00-09:00 and 17:00-19:00 on weekdays. Saturdays
            use a lighter schedule and Sundays are entirely off-peak.
          </p>
        </section>

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
            }}
          >
            {saved}
          </output>
        )}

      </form>

      <style>{`
        .billing-seasons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-5);
        }
        @media (max-width: 720px) {
          .billing-seasons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

   
    </div>
  );
}