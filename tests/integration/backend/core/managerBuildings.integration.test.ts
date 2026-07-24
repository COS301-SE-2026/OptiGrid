import { createCoreApiHarness, type CoreApiHarness, getAuthHeaders } from "./harness/core-api-harness";
import { insertIntegrationUsers } from "./harness/user-fixtures";

const {Client } = require("pg");
const req = require("supertest");
const {v4: uuidv4} = require("uuid");

jest.mock("../../../../backend/core/src/lib/influx", () => ({
    queryTotalKwh: jest.fn().mockResolvedValue(null),
}));

describe("Manger Buildings Page Integration tests", () => {
    let harness: CoreApiHarness;
    const tenantId = '8680c655-bfa3-433b-81aa-084fc76882d9';
    const managerUserId = 'bbe48b78-438f-4ed7-9fe7-a8fc9addc187';
    const viewerUserId = '1f11cc3f-c6a0-4d10-84fd-f27b9500862a';

    let managerHeader: {
        Cookie: string
    };
    let normalHeader: {
        Cookie:string
    };

    beforeAll(async () => {
        harness = await createCoreApiHarness();
        managerHeader = await getAuthHeaders(managerUserId);
        normalHeader = await getAuthHeaders(viewerUserId);
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
                    userId: managerUserId,
                    tenantId,
                    email: "maanger@optigrid.com",
                    firstName: "Manager",
                    lastName: "Testing",
                },
                {
                    userId: viewerUserId,
                    email: "normal@test.com",
                    firstName: "Test",
                    lastName: "Viewer",
                },
            ]);
            await client.query(
                `UPDATE users SET role_type = 'Building_Manager'
                WHERE user_id= $1`, [managerUserId] 
            );
            await client.query(
                `UPDATE users SET role_type = 'Viewer'
                WHERE user_id= $1`, [viewerUserId]
            )
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
                    values ($1, $2, $3, 'Residential', 230, 60, $4, $5)`,
                    [buildingId, tenantId, name, lifecycle_state, created_at],
            );
        } 
        finally {
            await client.end();
        }
        return buildingId;
    }
    //need this function to esnure the user exists in the userBuildingAccessTable else stuff will always fail
    async function helper(userId: string, buildingId: string) {
        const client = new Client({
            connectionString: harness.databaseUrl
        });
        await client.connect();
        try {
            await client.query(
                `INSERT into user_building_access (user_id, building_id) VALUES ($1, $2)`, [userId, buildingId]
            );
        }
        finally {
            await client.end();
        }
    }

    it("should_retun_assigned_buildings", async () => {
        const build = await building({
            name: "Test",
            lifecycle_state: "active"
        });
        await helper(managerUserId, build);
        await helper(viewerUserId, build);
        //act
        const resp = await req(harness.app).get("/api/buildings/manager")
        .set(managerHeader);
        const data = resp.body.data[0];
        //assert
        expect(resp.status).toBe(200);
        expect(resp.body.status).toBe("success");
        expect(resp.body.data).toHaveLength(1);
        expect(data.todays_usage).toBeNull();
    }) ;

    it("should_retunf_an_empty_array_if_no_building_assigned", async () => {
        await building({
            name: "Test",
            lifecycle_state: 'active'
        });
        //act
        const resp = await req(harness.app).get("/api/buildings/manager")
        .set(managerHeader);
        //assert
        expect(resp.status).toBe(200);
        expect(resp.body.status).toBe("success");
        expect(resp.body.data).toHaveLength(0);
    });
    it("should_return_401_error_if_no_headers", async () => {
        const resp = await req(harness.app).get("/api/buildings/manager")
        //assert
        expect(resp.status).toBe(401);
    });
});