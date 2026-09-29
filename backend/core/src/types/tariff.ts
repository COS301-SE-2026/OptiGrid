export interface TariffSeason {
  name: string;
  startMonth: number;
  endMonth: number;
}

export type TOUPeriod = "Peak" | "Standard" | "Off-Peak";

export interface TOUPeriodDefinition {
  period: TOUPeriod;
  startHour: number;
  endHour: number;
}

export interface TOUSchedule {
  weekday: TOUPeriodDefinition[];
  saturday: TOUPeriodDefinition[];
  sunday: TOUPeriodDefinition[];
}

export interface BlockRates {
  [season: string]: {
    [period: string]: number; 
  };
}

export interface TariffBlock {
  max_kwh: number | null;
  rates: BlockRates;
}

export interface TariffStructure {
  type: "flat" | "tou" | "block" | "block_tou";
  seasons: TariffSeason[];
  tou_schedule?: TOUSchedule;
  blocks: TariffBlock[];
}
