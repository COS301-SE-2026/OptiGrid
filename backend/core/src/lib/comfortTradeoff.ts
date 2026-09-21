export const COMFORT_TARGET = 80;

const NEUTRAL_TEMP_C = 22;
const SHED_PENALTY_SCALE = 165;
const WEATHER_AMPLIFIER = 0.05;
const MAX_COMFORT_PENALTY = 95;
const CURVE_EXPONENT = 2;
const PEAK_SHAVING_CONTEXT = 'Peak Shaving';

export interface TradeoffInputs {
    forecastPeakKw: number;
    thresholdKw: number;
    fullMonthlySavings: number;
    outsideTempC: number;
}

export interface TradeoffPoint {
    savings_level: number;
    monthly_savings: number;
    comfort_score: number;
    shed_kw: number;
}

export interface TradeoffProfile {
    comfort_target: number;
    full_monthly_savings: number;
    sweet_spot: TradeoffPoint;
    points: TradeoffPoint[];
}

export interface ApprovedTradeoff extends TradeoffPoint {
    comfort_target: number;
    meets_comfort_target: boolean;
    full_monthly_savings: number;
    approved_by: string;
    approved_at: string;
}

interface RecommendationLike {
    estimated_monthly_savings: unknown;
    applicable_range: unknown;
}

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export const readTradeoffInputs = (recommendation: RecommendationLike): TradeoffInputs | null => {
    const range = recommendation.applicable_range as Record<string, any> | null;
    if (!range || typeof range !== 'object' || range.context !== PEAK_SHAVING_CONTEXT) {
        return null;
    }

    const forecastPeakKw = toNumber(range.load_bounds_kw?.max_allowed);
    const thresholdKw = toNumber(range.load_bounds_kw?.min_expected);
    const fullMonthlySavings = toNumber(range.approved_tradeoff?.full_monthly_savings) ?? toNumber(recommendation.estimated_monthly_savings);

    if (forecastPeakKw === null || thresholdKw === null || fullMonthlySavings === null) {
        return null;
    }
    if (forecastPeakKw <= 0 || thresholdKw < 0 || forecastPeakKw <= thresholdKw || fullMonthlySavings <= 0) {
        return null;
    }

    return {
        forecastPeakKw,
        thresholdKw,
        fullMonthlySavings,
        outsideTempC: toNumber(range.tradeoff_inputs?.outside_temp_c) ?? NEUTRAL_TEMP_C
    };
};

export const maxComfortPenalty = (inputs: TradeoffInputs): number => {
    const shedShare = (inputs.forecastPeakKw - inputs.thresholdKw) / inputs.forecastPeakKw;
    const weatherStress = 1 + WEATHER_AMPLIFIER * Math.abs(inputs.outsideTempC - NEUTRAL_TEMP_C);
    return Math.min(MAX_COMFORT_PENALTY, SHED_PENALTY_SCALE * shedShare * weatherStress);
};

export const projectTradeoff = (inputs: TradeoffInputs, savingsLevel: number): TradeoffPoint => {
    const level = Math.min(100, Math.max(0, Math.round(savingsLevel)));
    const intensity = level / 100;
    const comfort = 100 - maxComfortPenalty(inputs) * intensity ** CURVE_EXPONENT;

    return {
        savings_level: level,
        monthly_savings: roundMoney(inputs.fullMonthlySavings * intensity),
        comfort_score: Math.min(100, Math.max(0, Math.round(comfort))),
        shed_kw: roundMoney((inputs.forecastPeakKw - inputs.thresholdKw) * intensity)
    };
};

export const buildTradeoffProfile = (inputs: TradeoffInputs): TradeoffProfile => {
    const points = Array.from({ length: 101 }, (_, level) => projectTradeoff(inputs, level));
    const sweetSpot = points.reduce((best, point) => (point.comfort_score >= COMFORT_TARGET ? point : best), points[0]);

    return {
        comfort_target: COMFORT_TARGET,
        full_monthly_savings: roundMoney(inputs.fullMonthlySavings),
        sweet_spot: sweetSpot,
        points
    };
};

export const approveTradeoff = (inputs: TradeoffInputs, savingsLevel: number, approvedBy: string, approvedAt: Date = new Date()): ApprovedTradeoff => {
    const point = projectTradeoff(inputs, savingsLevel);

    return {
        ...point,
        comfort_target: COMFORT_TARGET,
        meets_comfort_target: point.comfort_score >= COMFORT_TARGET,
        full_monthly_savings: roundMoney(inputs.fullMonthlySavings),
        approved_by: approvedBy,
        approved_at: approvedAt.toISOString()
    };
};