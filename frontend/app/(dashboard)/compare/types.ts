export type TimeRange = "7" | "30" | "90";
export type Metric = "R" | "kWh";

export type RawBuilding = {
    building_id?: unknown;
    building_name?: unknown;
    square_footage?: unknown;
};

export type Building = {
    id: string;
    name: string;
    squareFootage: number | null;
};

export type BuildingsResponse = {
    data?: unknown;
    message?: string;
};

export type ComparisonBuilding = {
    building_id: string;
    name: string;
    total_kwh: number;
    total_cost_zar: number;
    square_footage: number | null;
    eui: number | null;
    cost_per_sq_ft: number | null;
    cost_per_kwh: number;
};

export type ComparisonData = {
    time_range: string;
    mostEfficient: string | null;
    buildingA: ComparisonBuilding;
    buildingB: ComparisonBuilding;
};

export type ComparisonResponse = {
    status?: string;
    data?: ComparisonData;
    message?: string;
};
