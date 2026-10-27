import type { GraphicsQuality } from "@/lib/displayPreferences";

export type MapRenderOptions = {
    pixelRatio?: number;
    canvasContextAttributes?: {
        antialias: boolean;
        powerPreference: WebGLPowerPreference;
    };
};

// Auto leaves MapLibre on its own defaults and the other choices trade sharpness against battery life
export function mapRenderOptions(quality: GraphicsQuality, devicePixelRatio: number): MapRenderOptions {
    const deviceRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;

    if (quality === "saver") {
        return {
            pixelRatio: Math.min(deviceRatio, 1),
            canvasContextAttributes: { antialias: false, powerPreference: "low-power" },
        };
    }

    if (quality === "high") {
        return {
            pixelRatio: Math.min(deviceRatio, 2),
            canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
        };
    }

    return {};
}