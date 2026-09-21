import { resolveCoordinates, computeGeohash } from "../../../backend/core/src/services/geocode.service";
import geohash from "ngeohash";

describe("Geocode Service Unit Tests ", () => {
  let ogFetch: typeof fetch;
  beforeAll(() => {ogFetch = global.fetch;});
  afterAll(() => {global.fetch = ogFetch;});

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  it("should_return_null_for_empty_address", async () => {
    //act n then assert
    const res = await resolveCoordinates("");
    expect(res).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should_return_coords_for_given_address", async () => {
    //arrange
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          lat: "-25.7478676",
          lon: "28.2292712"
        }
      ]
    });
    //act
    const res = await resolveCoordinates("Pretoria, South Africa");
    //assert
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://nominatim.openstreetmap.org/search?q=Pretoria%2C+South+Africa"),
      expect.objectContaining({
        method: "GET",
        headers: {
          "User-Agent": expect.any(String)
        }
      })
    );
    //assert
    expect(res).toEqual({ latitude: -25.7478676, longitude: 28.2292712 });
  });

  it("should_return_null_if_api_sends_null", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });
    //act n assert
    const res = await resolveCoordinates("test");
    expect(res).toBeNull();
  });

  it("should_return_null_if_api_timesout_or_no_resp", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Error"));
    //act n assert
    const res = await resolveCoordinates("Pretoria, South Africa");
    expect(res).toBeNull();
  });

  it("should_calculate_correct_geohash", () => {
    const hash = computeGeohash(-25.7478676, 28.2292712);
    //assert
    expect(hash).toBe("kekjd2ez");
  });

  it("should_allow_custom_precision", () => {
    const hash = computeGeohash(-25.7478676, 28.2292712, 5);
    //assert
    expect(hash).toHaveLength(5);
  });
});
