import { humanise } from "./labels";

export const BUILDING_TYPES = [
    "Residential",
    "Commercial",
    "Industrial",
    "Healthcare",
    "Construction",
    "Mixed_Use",
    "ShoppingCentre",
    "Other",
] as const;

export const LIFECYCLE_STATES = ["PROVISIONING", "ACTIVE", "PROVISIONING_FAILED", "INACTIVE"] as const;
export const BUILDING_TYPE_OPTIONS = BUILDING_TYPES.map((value) => ({ value, label: humanise(value) }));
export const LIFECYCLE_OPTIONS = LIFECYCLE_STATES.map((value) => ({ value, label: humanise(value) }));