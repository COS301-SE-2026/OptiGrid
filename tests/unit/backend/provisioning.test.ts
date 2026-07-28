import { queueBuildingProvisioning, deleteInfluxBucket, getHardwareAuthToken } from "../../../backend/core/src/services/provisioning.service";

const mockOrgs = jest.fn();
const post = jest.fn();
const delBuckets = jest.fn();
const getBuckets = jest.fn();

jest.mock("@influxdata/influxdb-client", () => ({
    InfluxDB: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("@influxdata/influxdb-client-apis", () => ({
    OrgsAPI: jest.fn().mockImplementation(() => ({
        getOrgs: mockOrgs,
    })),
    BucketsAPI: jest.fn().mockImplementation(() => ({
        postBuckets: post,
        getBuckets: getBuckets,
        deleteBucketsID: delBuckets,
    })),
}));

global.fetch = jest.fn();

describe("Provisioning Service unit tests", () => {
    const env = process.env;
    const args = [
        "building123", "Test Building",
        220, 100, "test123", {}
    ] as const;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = {...env};
    });
    afterAll(() => {process.env = env});

    it("should_return_an_error_if_env_is_test", async () => {
        process.env.NODE_ENV = "test";
        //act
        await queueBuildingProvisioning(...args);
        //assert
        expect(mockOrgs).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should_provision_everything_successfully", async () => {
        process.env.NODE_ENV = "production";
        mockOrgs.mockResolvedValue({
            orgs: [{ 
                id: "orgs-123"
            }]
        });
        post.mockResolvedValue({});
        (global.fetch as jest.Mock).mockResolvedValue({ 
            ok: true, 
            status: 200 
        });
        //act
        //act
        await queueBuildingProvisioning(...args);
        //assert
        expect(mockOrgs).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalled();
        expect(post).toHaveBeenCalledWith({
            body: expect.objectContaining({
                name: "building-building123"
            })
        });
    });

    it("should_throw_an_error_if_fails", async () => {
        process.env.NODE_ENV = "production";
        mockOrgs.mockResolvedValue({orgs:[]});
        //act n assert
        await expect(queueBuildingProvisioning(...args)).rejects.toThrow("InfluxDB provisioning failed: Not found");
    });

    it("should_throw_error_if_ingestion_fails", async () => {
        process.env.NODE_ENV = "production";
        mockOrgs.mockResolvedValue({
            orgs: [{ 
                id: "orgs-123"
            }]
        });
        post.mockResolvedValue({});
        post.mockResolvedValue({});
        (global.fetch as jest.Mock).mockResolvedValue({ 
            ok: false, 
            status: 500,
            statusText: "Internal Server Error" 
        });
        //act n assert
        await expect(queueBuildingProvisioning(...args)).rejects
        .toThrow("Ingestion initialization failed: Ingestion service returned 500: Internal Server Error");
    });

    it("should_throw_error_if_analytics_fails", async () => {
        process.env.NODE_ENV = "production";
        mockOrgs.mockResolvedValue({
            orgs: [{ 
                id: "orgs-123"
            }]
        });
        post.mockResolvedValue({});
        post.mockResolvedValue({});

        (global.fetch as jest.Mock).mockResolvedValueOnce({ ok:true});
        (global.fetch as jest.Mock).mockResolvedValueOnce({ 
            ok: false, 
            status: 404,
            statusText: "Not Found" 
        });
        //act n assert
        await expect(queueBuildingProvisioning(...args)).rejects
        .toThrow("Analytics initialization failed: Analytics service returned 404: Not Found");
    });

    it("should_delete_buket_if_exists", async () => {
        process.env.NODE_ENV = "production";
        getBuckets.mockResolvedValue({
            buckets: [{
                id: "bucket123"
            }]
        });
        //act
        await deleteInfluxBucket("building123");
        //assert
        expect(getBuckets).toHaveBeenCalledWith({
            name: "building-building123"
        });
        expect(delBuckets).toHaveBeenCalledWith({
            bucketID: "bucket123"
        });
    });

    it("should_do_nothing_if_bucket_not_found", async () => {
        process.env.NODE_ENV = "production";
        getBuckets.mockResolvedValue({buckets: []});
        //act
        await deleteInfluxBucket("building123");
        //assert
        expect(delBuckets).not.toHaveBeenCalled();
    });

    it("should_catch_error_when_deleting_fails", async () => {
        process.env.NODE_ENV = "production";
        getBuckets.mockRejectedValue(new Error("Some Error"));
        //act n asssert
        await expect(deleteInfluxBucket("building123")).resolves.toBeUndefined();
    });
});