import type { GraphicsQuality } from "@/lib/displayPreferences";

export type TwinRenderSettings = {
    maxDpr: number;
    minDpr: number;
    antialias: boolean;
    powerPreference: "high-performance" | "low-power";
    adaptive: boolean;
    lowQuality: boolean;
    calm: boolean;
};

const AUTO_MAX_DPR = 1.75;
const HIGH_MAX_DPR = 2;

export function twinRenderSettings(quality: GraphicsQuality, devicePixelRatio: number): TwinRenderSettings {
    const deviceRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

    if (quality === "saver") {
        const ratio = Math.min(deviceRatio, 1);
        return { maxDpr: ratio, minDpr: ratio, antialias: false, powerPreference: "low-power", adaptive: false, lowQuality: true, calm: true };
    }

    if (quality === "high") {
        const ratio = Math.min(deviceRatio, HIGH_MAX_DPR);
        return { maxDpr: ratio, minDpr: ratio, antialias: true, powerPreference: "high-performance", adaptive: false, lowQuality: false, calm: false };
    }

    return {
        maxDpr: Math.min(deviceRatio, AUTO_MAX_DPR),
        minDpr: 1,
        antialias: true,
        powerPreference: "high-performance",
        adaptive: true,
        lowQuality: false,
        calm: false,
    };
}