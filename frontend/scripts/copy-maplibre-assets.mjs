import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(frontendRoot, "package.json"));
const maplibreDirectory = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const destination = join(frontendRoot, "public", "maplibre");
const assets = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

await mkdir(destination, { recursive: true });
await Promise.all(assets.map((asset) => copyFile(join(maplibreDirectory, asset), join(destination, asset))));

console.log(`Copied MapLibre worker assets to ${destination}`);
