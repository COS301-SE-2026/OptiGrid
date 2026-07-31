import { createCoreApiHarness, type CoreApiHarness } from "./harness/core-api-harness";

const req = require("supertest");
import { randomUUID as uuidv4 } from 'crypto';

describe.skip("Will enable later when needed", () => {
describe("Contact-Us Page Integration Tests", () => {
    let harness: CoreApiHarness;
    beforeAll(async () => {
        harness = await createCoreApiHarness();
        if(!process.env.RESEND_API_KEY) {
            console.warn("API KEY MISSING!");
            return;
        }
    }, 180000);

    afterAll(async () => {
        if(harness) await harness.stop();
    });

    it("should_return_a_test_email", async () => {
        const valid = {
            inquiryType: "General Inquiry",
            subject: "Integration Test",
            message: "Testing to see if behaviour is as expected"
        };

        const resp = await req(harness.app).post("/api/contact")
        .set("Idempotency-Key", `contact-${uuidv4()}`)
        .send(valid);

        expect(resp.status).toBe(200);
        expect(resp.body.success).toBe(true);
        expect(resp.body.message).toBe("Received the ticket");
        expect(typeof resp.body.id).toBe("string");
    });

    it("shoudl_prevent_duplicate_emails_from_same_idempotency_key", async () =>{
        const same= {
            inquiryType: "General Inquiry",
            subject: "Integration Test",
            message: "Only on email should be sent to our email address"
        };

        const key = `contact-${uuidv4()}`;

        const resp1 = await req(harness.app).post("/api/contact")
        .set("Idempotency-Key", key)
        .send(same);

        const resp2 = await req(harness.app).post("/api/contact")
        .set("Idempotency-Key", key)
        .send(same);

        expect(resp1.status).toBe(200);
        expect(resp2.status).toBe(200);
        expect(resp1.body).toEqual(resp2.body);

    });

    it("should_return_an_error_when_validation_fails", async () => {
        const invalid = {
            inquiryType: "General Inquiry",
            subject: "Integration Test",
        };

        const resp = await req(harness.app).post("/api/contact")
        .send(invalid);

        expect(resp.status).toBe(400);
        expect(resp.body.success).toBe(false);
        expect(resp.body.error).toBe("error message");
    });
});
});