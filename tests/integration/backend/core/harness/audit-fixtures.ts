import type { Client } from 'pg';
import { insertIntegrationUsers } from './user-fixtures';

export type AuditRole = 'Admin' | 'Building_Manager' | 'Viewer';

export type AuditUserFixture = {
	userId: string;
	tenantId: string;
	email: string;
	role: AuditRole;
};

export type AuditLogFixture = {
	logId: string;
	userId?: string | null;
	buildingId?: string | null;
	actionType: string;
	targetTable: string;
	service?: string | null;
	operation?: string | null;
	severity?: 'info' | 'warning' | 'error' | 'critical' | null;
	ipAddress?: string | null;
	timestamp: string;
};

export async function insertAuditTenant(client: Client, tenantId: string): Promise<void> {
	await client.query(
		`insert into tenants (tenant_id, company_name)
		 values ($1, 'Audit Integration Tenant')
		 on conflict (tenant_id) do nothing`,
		[tenantId],
	);
}

export async function insertAuditUsers(client: Client, users: AuditUserFixture[]): Promise<void> {
	await insertIntegrationUsers(
		client,
		users.map((user) => ({
			userId: user.userId,
			tenantId: user.tenantId,
			email: user.email,
			firstName: 'Audit',
			lastName: 'Tester',
		})),
	);

	for (const user of users) {
		await client.query(
			`update users
			 set role_type = $2::user_role
			 where user_id = $1`,
			[user.userId, user.role],
		);
	}
}

export async function insertAuditBuilding(
	client: Client,
	buildingId: string,
	tenantId: string,
	name: string,
): Promise<void> {
	await client.query(
		`insert into buildings (
			building_id,
			tenant_id,
			building_name,
			building_type,
			timezone
		) values ($1, $2, $3, 'Commercial', 'Africa/Johannesburg')`,
		[buildingId, tenantId, name],
	);
}

export async function grantAuditBuildingAccess(
	client: Client,
	userId: string,
	buildingId: string,
): Promise<void> {
	await client.query(
		`insert into user_building_access (user_id, building_id)
		 values ($1, $2)`,
		[userId, buildingId],
	);
}

export async function insertAuditLogs(client: Client, logs: AuditLogFixture[]): Promise<void> {
	for (const log of logs) {
		await client.query(
			`insert into audit_logs (
				log_id,
				user_id,
				building_id,
				action_type,
				target_table,
				service,
				operation,
				severity,
				ip_address,
				timestamp
			) values ($1, $2, $3, $4, $5, $6, $7, $8::audit_severity, $9, $10)`,
			[
				log.logId,
				log.userId ?? null,
				log.buildingId ?? null,
				log.actionType,
				log.targetTable,
				log.service ?? null,
				log.operation ?? null,
				log.severity ?? null,
				log.ipAddress ?? null,
				log.timestamp,
			],
		);
	}
}
