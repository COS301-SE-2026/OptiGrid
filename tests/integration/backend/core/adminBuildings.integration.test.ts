import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from "./harness/core-api-harness";
import { insertIntegrationUsers } from "./harness/user-fixtures";

const {Client } = require("pg");
const req = require("supertest");
import { v4 as uuidv4 } from 'uuid';

describe("Get all buildings and manage state for admin and building manager", () => {
    let harness: CoreApiHarness;
    const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
    const adminUserId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
    const normalUserId = '1f11cc3f-c6a0-4d10-84fd-f27b9500862a';

    let adminHeader: {
        Cookie: string
    };
    let normalHeader: {
        Cookie:string
    };

    beforeAll(async () => {
        harness = await createCoreApiHarness();
        adminHeader = await getAuthHeaders(adminUserId);
        normalHeader = await getAuthHeaders(normalUserId);
    }, 180000);

    beforeEach( async () => {
        const client = new Client({
            connectionString: harness.databaseUrl
        });
        await client.connect();

        try {
            await client.query(
                `INSERT into tenants (tenant_id, company_name)
                VALUES ($1, $2)
                ON CONFLICT (tenant_id) DO NOTHING`,
                [tenantId, 'Test'],
            );
            await insertIntegrationUsers(client, [
                {
                    userId: adminUserId,
                    tenantId,
                    email: "admin@gmail.com",
                    firstName: "Admin",
                    lastName: "Testing",
                },
                {
                    userId: normalUserId,
                    email: "normal@test.com",
                    firstName: "Test",
                    lastName: "Viewer",
                },
            ]);
            await client.query(
                `UPDATE users SET role_type = 'ADMIN'
                WHERE user_id= $1`, [adminUserId] 
            );
        }
        finally {
            await client.end();
        }
    });
    afterEach(async () => {
        if(harness) await harness.resetDatabase();
    });
    afterAll(async () => {
        if(harness) await harness.stop();
    });

    async function building({
        buildingId = uuidv4(),
        name,
        lifecycle_state= 'provisioning',
        created_at = new Date().toISOString(),
    } : {
        buildingId?: string;
        name:string;
        lifecycle_state?: string;
        created_at?: string;
    }) {
        const client = new Client({
            connectionString: harness.databaseUrl
        });
        await client.connect();
        
        try{
            await client.query(
                `insert into buildings (
                    building_id,
                    tenant_id,
                    building_name,
                    building_type,
                    nominal_voltage,
                    max_current_threshold,
                    lifecycle_state,
                    created_at
                ) 
                    values ($1, $2, $3, 'Commercial', 230, 60, $4, $5)`,
                    [buildingId, tenantId, name, lifecycle_state, created_at],
            );
        } 
        finally {
            await client.end();
        }
        return buildingId;
    }

    it("should_return_all_buildings", async () => {
        await building({
            name: "Admin 1"
        });
        await building({
            name: "admin 2"
        });

        const resp = await req(harness.app).get("/api/buildings/admin/")
        .set(adminHeader);

        expect(resp.status).toBe(200);
        expect(resp.body.status).toBe("success");
        expect(resp.body.data).toHaveLength(2);
    });

    it("should_reutrn_only_mathing_buildings_by_filter", async ()=> {
        await building({
            name: "Admin 1"
        });
        await building({
            name: "admin 2",
            lifecycle_state: 'active'
        });

        const resp = await req(harness.app).get("/api/buildings/admin?lifecycle_state=ACTIVE")
        .set(adminHeader);

        expect(resp.status).toBe(200);
        expect(resp.body.status).toBe("success");
        expect(resp.body.data).toHaveLength(1);
        expect(resp.body.data[0].building_name).toBe('admin 2');
        expect(resp.body.data[0].lifecycle_state).toBe('ACTIVE');
    });

    it("should_return_400_if_invalid_state_provided", async () => {
        await building({
            name: "Admin 1"
        });
        await building({
            name: "admin 2",
            lifecycle_state: "active"
        });

        const resp = await req(harness.app).get("/api/buildings/admin?lifecycle_state=Wrong")
        .set(adminHeader);

        expect(resp.status).toBe(400);
        expect(resp.body.status).toBe("error");
        expect(resp.body.message).toBe("Invalid request payload");
    
    });

    it("should_return_a_403_error_if_not_admin", async () => {
        const resp = await req(harness.app).get("/api/buildings/admin/")
        .set(normalHeader);

        expect(resp.status).toBe(403);
        expect(resp.body.status).toBe("error");
        expect(resp.body.message).toBe("You do not have enough permission");
    });
});