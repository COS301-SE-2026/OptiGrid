import { approveTradeoff, buildTradeoffProfile, COMFORT_TARGET, projectTradeoff, readTradeoffInputs, type TradeoffInputs } from '../../../backend/core/src/lib/comfortTradeoff';

const peakShaving = (rangeOverrides: Record<string, unknown> = {}, estimated: unknown = 500) => ({
    estimated_monthly_savings: estimated,
    applicable_range: {
        context: 'Peak Shaving',
        load_bounds_kw: { min_expected: 100, max_allowed: 150 },
        tradeoff_inputs: { outside_temp_c: 22 },
        ...rangeOverrides
    }
});

const mildDay: TradeoffInputs = { forecastPeakKw: 150, thresholdKw: 100, fullMonthlySavings: 500, outsideTempC: 22 };

describe('reading trade-off inputs', () => {
    it('reads the load bounds alongisde the savings and weather from a peak shaving recommendation', () => {
        expect(readTradeoffInputs(peakShaving())).toEqual(mildDay);
    });

    it('accepts savings stored as a decimal string', () => {
        expect(readTradeoffInputs(peakShaving({}, '500.00'))?.fullMonthlySavings).toBe(500);
    });

    it('assumes neutral weather when none was recorded', () => {
        expect(readTradeoffInputs(peakShaving({ tradeoff_inputs: undefined }))?.outsideTempC).toBe(22);
    });

    it('keeps the full strength savings after an approval has lowered the estimate', () => {
        const approved = peakShaving({ approved_tradeoff: { full_monthly_savings: 500 } }, 305);
        expect(readTradeoffInputs(approved)?.fullMonthlySavings).toBe(500);
    });

    it('ignores recommendations that are not peak shaving', () => {
        expect(readTradeoffInputs(peakShaving({ context: 'Summer Lighting' }))).toBeNull();
        expect(readTradeoffInputs({ estimated_monthly_savings: 500, applicable_range: null })).toBeNull();
    });

    it('ignores peak shaving data that cannot describe a trade-off', () => {
        expect(readTradeoffInputs(peakShaving({ load_bounds_kw: { min_expected: 150, max_allowed: 150 } }))).toBeNull();
        expect(readTradeoffInputs(peakShaving({ load_bounds_kw: { max_allowed: 150 } }))).toBeNull();
        expect(readTradeoffInputs(peakShaving({}, 0))).toBeNull();
    });
});

describe('projecting savings against comfort', () => {
    it('keeps full comfort and saves nothing at the maximum comfort end', () => {
        expect(projectTradeoff(mildDay, 0)).toEqual({ savings_level: 0, monthly_savings: 0, comfort_score: 100, shed_kw: 0 });
    });

    it('saves the full estimate but drops comfort to 45 at the aggressive end on a mild day', () => {
        expect(projectTradeoff(mildDay, 100)).toEqual({ savings_level: 100, monthly_savings: 500, comfort_score: 45, shed_kw: 50 });
    });

    it('costs more comfort for each extra step towards aggressive savings', () => {
        const gentleHalf = projectTradeoff(mildDay, 0).comfort_score - projectTradeoff(mildDay, 50).comfort_score;
        const hardHalf = projectTradeoff(mildDay, 50).comfort_score - projectTradeoff(mildDay, 100).comfort_score;
        expect(hardHalf).toBeGreaterThan(gentleHalf);
    });

    it('lets hot weather amplify the comfort penalty', () => {
        expect(projectTradeoff({ ...mildDay, outsideTempC: 35 }, 100).comfort_score).toBe(9);
    });

    it('caps the penalty so comfort never falls below 5', () => {
        expect(projectTradeoff({ ...mildDay, thresholdKw: 0 }, 100).comfort_score).toBe(5);
    });

    it('Restricts and rounds values that fall outside the slider range', () => {
        expect(projectTradeoff(mildDay, 140).savings_level).toBe(100);
        expect(projectTradeoff(mildDay, -5).savings_level).toBe(0);
        expect(projectTradeoff(mildDay, 60.6).savings_level).toBe(61);
    });
});

describe('finding the sweet spot', () => {
    it('picks the highest savings level that still holds comfort at the target', () => {
        const profile = buildTradeoffProfile(mildDay);
        expect(profile.comfort_target).toBe(COMFORT_TARGET);
        expect(profile.sweet_spot).toEqual({ savings_level: 61, monthly_savings: 305, comfort_score: 80, shed_kw: 30.5 });
        expect(profile.points[62].comfort_score).toBeLessThan(COMFORT_TARGET);
    });

    it('moves the sweet spot towards comfort when the weather is harsh', () => {
        expect(buildTradeoffProfile({ ...mildDay, outsideTempC: 35 }).sweet_spot.savings_level).toBe(47);
    });

    it('covers every slider position with savings rising as comfort falls', () => {
        const { points } = buildTradeoffProfile(mildDay);

        expect(points).toHaveLength(101);
        points.slice(1).forEach((point, index) => {
            expect(point.monthly_savings).toBeGreaterThanOrEqual(points[index].monthly_savings);
            expect(point.comfort_score).toBeLessThanOrEqual(points[index].comfort_score);
        });
    });
});

describe('approving a trade-off', () => {
    const approvedAt = new Date('2026-09-15T10:00:00.000Z');

    it('records a setting that meets the comfort target', () => {
        expect(approveTradeoff(mildDay, 61, 'manager-1', approvedAt)).toEqual({
            savings_level: 61,
            monthly_savings: 305,
            comfort_score: 80,
            shed_kw: 30.5,
            comfort_target: 80,
            meets_comfort_target: true,
            full_monthly_savings: 500,
            approved_by: 'manager-1',
            approved_at: '2026-09-15T10:00:00.000Z'
        });
    });

    it('flags a setting that breaks the comfort target', () => {
        const approval = approveTradeoff(mildDay, 90, 'manager-1', approvedAt);
        expect(approval.comfort_score).toBe(55);
        expect(approval.meets_comfort_target).toBe(false);
    });
});