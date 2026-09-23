import { TariffStructure, TariffSeason, TOUSchedule, TOUPeriodDefinition } from '../types/tariff';

export function getSeason(date: Date, seasons: TariffSeason[]): string | null {
    const month = date.getMonth() + 1;

    for(const season of seasons) {
        if(season.startMonth <= season.endMonth) {
            if(month >= season.startMonth && month <= season.endMonth) return season.name;
        }
        else{
            if(month >= season.startMonth || month <= season.endMonth) return season.name;
        }
    }
    return seasons[0]?.name || null;
}

export function getTOUPeriod(date: Date, schedule: TOUSchedule): string | null {
    const day = date.getDay();
    const hour = date.getHours();
    let definitions: TOUPeriodDefinition[] = [];

    if(day === 0) definitions = schedule.sunday;
    else if(day === 6) definitions = schedule.saturday;
    else definitions = schedule.weekday;

    for(const i of definitions) {
        if(hour >= i.startHour && hour < i.endHour) return i.period;
    }
    return "Flat";
}

export function calculateCost(timestamp: string, kwh: number, totalKWh: number, tariff: TariffStructure): number {
    if(!tariff) return 0;
    
    const date = new Date(timestamp);
    const season = getSeason(date, tariff.seasons || []) || "Flat";
    const touPeriod = tariff.tou_schedule ? getTOUPeriod(date, tariff.tou_schedule) : "Flat";
    
    if(tariff.type === "flat")return kwh * (tariff.blocks?.[0]?.rates?.[season]?.[touPeriod || "Flat"] || 0);
    
    let cost = 0;
    let remainingKwh = kwh;
    let currTotal = totalKWh;

    for(const i of (tariff.blocks || [])) {
        if(remainingKwh <= 0) break;

        const rate = i.rates[season]?.[touPeriod || "Flat"] || 0;
        if(i.max_kwh === null) {
            cost += remainingKwh * rate;
            break;
        }

        const availableInBlock = Math.max(0, i.max_kwh - currTotal);
        if(availableInBlock > 0) {
            const kwhToCharge = Math.min(remainingKwh, availableInBlock);
            cost += kwhToCharge * rate;
            remainingKwh -= kwhToCharge;
            currTotal += kwhToCharge;
        }
    }
    return cost;
}
