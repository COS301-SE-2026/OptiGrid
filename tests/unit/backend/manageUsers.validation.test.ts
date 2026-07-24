import { userBuildingsSchema } from "../../../backend/core/src/validation/user_auth.validation";

describe("Validation tests for user buildings schema", () => {
    it("should_pass_if_all_details_given", async () => {
        const valid = {
            body: {
                userId: "testUser",
                buildingId: "building-123",
            },
        };
        const out = userBuildingsSchema.safeParse(valid);
        //assert
        expect(out.success).toBe(true);
    });

    it("should_fail_if_no_user_id", async () => {
        const valid = {
            body: {
                buildingId: "building-123",
            },
        };
        //act n assert
        expect(() => userBuildingsSchema.parse(valid)).toThrow("User ID is missing");
    });

     it("should_fail_if_no_building_id", async () => {
        const valid = {
            body: {
                userId: "user-123",
            },
        };
        //act n assert
        expect(() => userBuildingsSchema.parse(valid)).toThrow("Building ID is missing");
    });
})