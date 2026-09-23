"use client";

import { useState, type FormEvent } from "react";
import { useBuildings } from "@/lib/useBuildings";
import { PageHeading } from "@/components/PageHeading";
import { FormAlert } from "@/components/FormAlert";

type RatesState = {
    Summer: { Peak: string; Standard: string; "Off-Peak": string };
    Winter: { Peak: string; Standard: string; "Off-Peak": string };
};

type Season = keyof RatesState;
type RatePeriod = keyof RatesState[Season];

const RATE_PERIODS: RatePeriod[] = ["Peak", "Standard", "Off-Peak"];

const initialRates: RatesState = {
    Summer: { Peak: "2.50", Standard: "1.50", "Off-Peak": "1.00" },
    Winter: { Peak: "3.50", Standard: "2.00", "Off-Peak": "1.50" }
};

type SeasonRateCardProps = {
    season: Season;
    heading: string;
    colour: string;
    rates: RatesState[Season];
    onRateChange: (season: Season, period: RatePeriod, value: string) => void;
};

function SeasonRateCard({ season, heading, colour, rates, onRateChange }: SeasonRateCardProps) {
    return (
        <div style={{
            background: `color-mix(in srgb, ${colour} 5%, transparent)`,
            border: `1px solid color-mix(in srgb, ${colour} 20%, transparent)`,
            padding: "var(--space-4)",
            borderRadius: "var(--radius-lg)"
        }}>
            <h3 style={{ margin: "0 0 var(--space-4) 0", color: colour }}>{heading}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {RATE_PERIODS.map(period => (
                    <div key={`${season}-${period}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ fontSize: "var(--fs-small)", fontWeight: 500 }}>{period}</label>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span className="text-muted" style={{ fontSize: "var(--fs-small)" }}>R</span>
                            <input
                                type="number"
                                step="0.01"
                                className="input"
                                value={rates[period]}
                                onChange={event => onRateChange(season, period, event.target.value)}
                                style={{ width: "100px", padding: "var(--space-1) var(--space-2)" }}
                            />
                        </div>
                    </div>
                ))}
            </div>
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

    const handleRateChange = (season: Season, period: RatePeriod, value: string) => {
        setRates(prev => ({
            ...prev,
            [season]: {
                ...prev[season],
                [period]: value
            }
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
                { name: "Winter", startMonth: 6, endMonth: 8 }
            ],
            tou_schedule: {
                weekday: [
                    { period: "Off-Peak", startHour: 0, endHour: 6 },
                    { period: "Peak", startHour: 6, endHour: 9 },
                    { period: "Standard", startHour: 9, endHour: 17 },
                    { period: "Peak", startHour: 17, endHour: 19 },
                    { period: "Standard", startHour: 19, endHour: 22 },
                    { period: "Off-Peak", startHour: 22, endHour: 24 }
                ],
                saturday: [
                    { period: "Off-Peak", startHour: 0, endHour: 7 },
                    { period: "Standard", startHour: 7, endHour: 12 },
                    { period: "Off-Peak", startHour: 12, endHour: 18 },
                    { period: "Standard", startHour: 18, endHour: 20 },
                    { period: "Off-Peak", startHour: 20, endHour: 24 }
                ],
                sunday: [
                    { period: "Off-Peak", startHour: 0, endHour: 24 }
                ]
            },
            blocks: [
                {
                    max_kwh: null,
                    rates: {
                        Summer: {
                            Peak: Number(rates.Summer.Peak),
                            Standard: Number(rates.Summer.Standard),
                            "Off-Peak": Number(rates.Summer["Off-Peak"])
                        },
                        Winter: {
                            Peak: Number(rates.Winter.Peak),
                            Standard: Number(rates.Winter.Standard),
                            "Off-Peak": Number(rates.Winter["Off-Peak"])
                        }
                    }
                }
            ]
        };

        try {
            const res = await fetch(`/api/buildings/${buildingId}/tariffs`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(complexPayload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message ?? "Failed to update the tariff rates.");
            setSaved(data?.message ?? "Complex Tariff rules updated successfully.");
        }
        catch (err) {
            setApiError(err instanceof Error ? err.message : "Failed to update the tariff rates.");
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <PageHeading
                title="Advanced Tariff Builder"
                subtitle="Configure comprehensive Time-of-Use and Seasonal rates based on Eskom schedules."
            />

            <form onSubmit={handleSubmit} noValidate className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <label className="label" htmlFor="building_id" style={{ fontWeight: 600 }}>Target Building</label>
                    <select
                        id="building_id"
                        className="select"
                        value={buildingId}
                        onChange={e => { setBuildingId(e.target.value); setApiError(""); setSaved(""); }}
                        disabled={loading || buildingsLoading || buildings.length === 0}
                        style={{ maxWidth: "400px" }}
                    >
                        <option value="">{buildingsLoading ? "Loading buildings..." : "Select building"}</option>
                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {buildingsError && (
                        <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>
                            Unable to load your buildings right now.
                        </p>
                    )}
                    {!buildingsLoading && !buildingsError && buildings.length === 0 && (
                        <p className="text-muted" style={{ fontSize: "var(--fs-small)" }}>
                            No buildings are currently assigned to your account.
                        </p>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
                    <SeasonRateCard
                        season="Summer"
                        heading="☀️ Summer (Sep - May)"
                        colour="var(--brand-warning)"
                        rates={rates.Summer}
                        onRateChange={handleRateChange}
                    />
                    <SeasonRateCard
                        season="Winter"
                        heading="❄️ Winter (Jun - Aug)"
                        colour="var(--brand-info)"
                        rates={rates.Winter}
                        onRateChange={handleRateChange}
                    />
                </div>

                <div style={{ padding: "var(--space-4)", background: "var(--gray-50)", borderRadius: "var(--radius-md)", fontSize: "var(--fs-small)" }}>
                    <p style={{ margin: 0 }}><strong>Info:</strong> This tariff builder uses the standard Eskom Megaflex Time-of-Use schedule. Weekday peaks are 06:00-09:00 and 17:00-19:00.</p>
                </div>

                {apiError && <FormAlert message={apiError} />}
                {saved && (
                    <output style={{ color: "var(--brand-success)", padding: "var(--space-3) var(--space-4)", border: "1px solid var(--brand-success)", background: "color-mix(in srgb, var(--brand-success) 12%, transparent)", borderRadius: "var(--radius-md)", fontSize: "var(--fs-small)" }}>
                        {saved}
                    </output>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: "var(--space-3) var(--space-6)", fontSize: "var(--fs-medium)" }}>
                        {loading ? "Saving Tariff..." : "Save Tariff Schedule"}
                    </button>
                </div>
            </form>
        </div>
    );
}
