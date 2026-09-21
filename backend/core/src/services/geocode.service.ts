import geohash from "ngeohash";
/**
 * this file has 2 functions, one is to resolveCoordinates which calculates the 
 * latitude and longitude of an address taht is going to be used in heatmap
 * The 2nd function calculates the geohash string which is also going to be used in heatmap
 */
const USER_AGENT = "OptiGrid-Geocoding-Service/1.0 (contact@optigrid.dev)";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 5000;

interface Coordinates {
  latitude: number;
  longitude: number;
}

export const resolveCoordinates = async (address: string): Promise<Coordinates | null> => {
  if (!address || address.trim() === "") return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const url = new URL(NOMINATIM_URL);

    url.searchParams.append("q", address);
    url.searchParams.append("format", "json");
    url.searchParams.append("limit", "1");

    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn(`API returned ${resp.status} for geocoding address: "${address}"`);
      return null;
    }

    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      const res = data[0];
      const latitude = Number.parseFloat(res.lat);
      const longitude = Number.parseFloat(res.lon);

      if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
        return { 
          latitude, 
          longitude 
        };
      }
    }
    return null;
  } 
  catch (error: any) {
    if (error.name === "AbortError") console.warn(`Request timed out for geocode address "${address}"`);
    else console.warn(`Failed to get coords for geocoding address "${address}":`, error.message);

    return null;
  }
};

export const computeGeohash = (latitude: number, longitude: number, precision: number = 8): string => {
  return geohash.encode(latitude, longitude, precision);
};
