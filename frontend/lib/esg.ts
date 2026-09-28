const API_BASE = typeof window === "undefined"
    ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "")
    : "";

export type EsgDimension =
  | "energy_efficiency"
  | "renewables"
  | "hvacLoad"
  | "lighting";

export interface DimensionScore {
 
  dimension: EsgDimension;
  label: string;
  score: number;
  weight: number;
  trend: -1 | 0 | 1;
}

export interface EsgHealthScore {
  buildingId: string;
  score: number;
  scoreLabel: "Operational environmental proxy";
  computedAt: string;
  trend: -1 | 0 | 1;
  dimensions: DimensionScore[];
  carbonIntensity: number | null;
  carbonAccounting: {
    source: "carbon_ledger" | "unavailable";
    periodDate: string | null;
    totalKwh: number | null;
    totalKgCo2e: number | null;
    emissionFactorKgCo2ePerKwh: number | null;
    integrityStatus: "PENDING" | "VALID" | "TAMPERED" | "INCOMPLETE" | "UNAVAILABLE";
  };
  scope: {
    primaryPillar: "environmental";
    energyEvidence: "telemetry_derived" | "fallback_defaults";
    carbonEvidence: "ledger_backed" | "unavailable";
    governanceEvidence: "carbon_ledger_integrity_only" | "unavailable";
    socialMetrics: "not_included";
  };
  energyHistory: number[];
}

export interface ScenarioParams {
  energyEfficiency?: number;
  renewables?: number;
  hvacLoad?: number;
  lighting?: number;
  hvacReduction?: number;
  loadShiftHours?: number;
  solarAddition?: number;
  waterReduction?: number;
  ledRetrofit?: number;
  projectionMonths?: number;
}

export interface ForecastDataPoint {

  month: string;
  baselineScore: number;
  scenarioScore: number;
  baselineCarbon: number | null;
  scenarioCarbon: number | null;
}

export interface ScenarioResult {
  buildingId: string;
   params: ScenarioParams;
  forecast: ForecastDataPoint[];
  
  impact: {

    scoreDelta: number;
    totalCarbonAvoided: number | null;
    equivalentTrees: number | null;
    carbonReduction: number;
    estimatedCostSavings: number | null;
  };
  methodology: {
    deterministic: true;
    baselineSource: "carbon_ledger" | "unavailable";
    ledgerDays: number;
    baselineMonthlyKwh: number | null;
    baselineMonthlyKgCo2e: number | null;
    estimatedTariffZarPerKwh: number;
  };
}

export class EsgApiError extends Error {
  constructor(
    
    public readonly status: number,
    message: string,
    
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "EsgApiError";
  }
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as Record<string, unknown>).message === "string"
        ? (body as { message: string }).message
        : `ESG API request failed with status ${response.status}`;
    throw new EsgApiError(response.status, message, body);
  }
  return response.json() as Promise<T>;
}

export async function fetchEsgHealthScore(
  buildingId: string,
): Promise<EsgHealthScore> {
  if (!buildingId) {
    throw new Error("fetchEsgHealthScore: buildingId must not be empty.");
  }
  return apiFetch<EsgHealthScore>(
    `/api/buildings/${encodeURIComponent(buildingId)}/esg/health-score`,
  );
}

export async function simulateEsgScenario(
  buildingId: string,
  params: ScenarioParams,
): Promise<ScenarioResult> {
  if (!buildingId) {
    throw new Error("simulateEsgScenario: buildingId must not be empty.");
  }
  return apiFetch<ScenarioResult>(
    `/api/buildings/${encodeURIComponent(buildingId)}/esg/simulate`,
    {
      method: "POST",
      body: JSON.stringify(params),
    },
  );
}
