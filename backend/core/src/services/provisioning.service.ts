import { InfluxDB } from '@influxdata/influxdb-client';
import { BucketsAPI } from '@influxdata/influxdb-client-apis';
import prisma from '../lib/prisma';

const INFLUX_URL = process.env.INFLUXDB_URL || 'http://localhost:8086';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '';
const INFLUX_ORG = process.env.INFLUXDB_ORG || 'OptiGrid';
const INFLUX_BUCKET_PREFIX = process.env.INFLUX_BUCKET_PREFIX || 'building_';
const DATA_RETENTION_DAYS = 30;

export async function queueBuildingProvisioning(
  buildingId: string,
  buildingName: string,
  nominalVoltage: number,
  maxCurrentThreshold: number,
  hardwareAuthToken: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    console.log(`[PROVISIONING] Starting async provisioning for building: ${buildingId} (${buildingName})`);
    const influxBucketName = await provisionInfluxDBBucket(buildingId, buildingName, nominalVoltage, maxCurrentThreshold);
    await initializeIngestionService(buildingId, hardwareAuthToken, nominalVoltage, maxCurrentThreshold, influxBucketName, metadata);
    await initializeAnalyticsService(buildingId, buildingName);

    // Step 4: On success, update lifecycle_state to ACTIVE
    await prisma.building.update({
      where: { building_id: buildingId },
      data: { lifecycle_state: 'ACTIVE' },
    });
    console.log(`[PROVISIONING] ✓ Successfully provisioned building: ${buildingId}`);
  } catch (error) {
    console.error(`[PROVISIONING] ✗ Failed to provision building ${buildingId}:`, error);

    // Step 4: On failure, update lifecycle_state to PROVISIONING_FAILED so UI can prompt retry
    try {
      await prisma.building.update({
        where: { building_id: buildingId },
        data: { lifecycle_state: 'PROVISIONING_FAILED' },
      });
      console.log(`[PROVISIONING] Marked building ${buildingId} as PROVISIONING_FAILED`);
    } catch (dbErr) {
      console.error(`[PROVISIONING] Failed to update lifecycle_state for ${buildingId}:`, dbErr);
    }

    // Re-throw so the caller in building.services.ts can log it
    throw error;
  }
}

async function provisionInfluxDBBucket(
  buildingId: string,
  buildingName: string,
  nominalVoltage: number,
  maxCurrentThreshold: number
): Promise<string> {
  const bucketName = `${INFLUX_BUCKET_PREFIX}${buildingId}`;
  const retentionSeconds = DATA_RETENTION_DAYS * 24 * 3600;

  try {
    const influxClient = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    const bucketsAPI = new BucketsAPI(influxClient);
    const buckets = await bucketsAPI.getBuckets();
    const bucketConfig = {
      orgID: INFLUX_ORG,
      name: bucketName,
      description: `Telemetry metrics for ${buildingName}`,
      retentionRules: [{ 
        type: 'expire' as const, 
        everySeconds: retentionSeconds 
      }]
    };

    console.log(`[INFLUX] Creating bucket: ${bucketName}`);
    console.log(`[INFLUX] Bucket config:
      - Name: ${bucketName}
      - Description: Telemetry data for ${buildingName}
      - Nominal Voltage: ${nominalVoltage}V
      - Max Current Threshold: ${maxCurrentThreshold}A
      - Retention Policy: ${DATA_RETENTION_DAYS} days
      - Organization: ${INFLUX_ORG}`);

    try {
      await bucketsAPI.postBuckets({body: bucketConfig});
      console.log(`[INFLUX] Created bucket ${bucketName}`);
    } catch (error: any) {
      const message = String(error?.message || error);
      if (message.includes('already exists') || error?.statusCode === 409) {
        console.log(`[INFLUX] Bucket already exists: ${bucketName}`);
      } else {
        throw error;
      }
    }

    return bucketName;
  } catch (error) {
    console.error(`[INFLUX] Failed to create bucket for building ${buildingId}:`, error);
    throw new Error(`InfluxDB provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function initializeIngestionService(
  buildingId: string,
  hardwareAuthToken: string,
  nominalVoltage: number,
  maxCurrentThreshold: number,
  influxBucketName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const ingestionUrl = (process.env.INGESTION_API_URL || 'http://localhost:8000')
    .replace(/;$/, '')
    .trim();

  try {
    const response = await fetch(`${ingestionUrl}/init-building`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        building_id: buildingId,
        hardware_auth_token: hardwareAuthToken,
        nominal_voltage: nominalVoltage,
        max_current_threshold: maxCurrentThreshold,
        influx_bucket: influxBucketName,
        metadata: metadata || {},
        initialized_at: new Date().toISOString(),
        status: 'ACTIVE_UNMAPPED'
      })
    });

    if (!response.ok) {
      throw new Error(`Ingestion service returned ${response.status}: ${response.statusText}`);
    }

    console.log(`[INGESTION] ✓ Initialized ingestion service for building: ${buildingId}`);
  } catch (error) {
    console.error(`[INGESTION] Failed to initialize ingestion for building ${buildingId}:`, error);
    throw new Error(`Ingestion initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function initializeAnalyticsService(
  buildingId: string,
  buildingName: string
): Promise<void> {
  const analyticsUrl = (process.env.ANALYTICS_API_URL || 'http://localhost:5001')
    .replace(/;$/, '')
    .trim();

  try {
    const response = await fetch(`${analyticsUrl}/init-building`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        building_id: buildingId,
        building_name: buildingName,
        initialized_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`Analytics service returned ${response.status}: ${response.statusText}`);
    }

    console.log(`[ANALYTICS] ✓ Initialized analytics service for building: ${buildingId}`);
  } catch (error) {
    console.error(`[ANALYTICS] Failed to initialize analytics for building ${buildingId}:`, error);
    throw new Error(`Analytics initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHardwareAuthToken(buildingId: string): Promise<string | null> {
  console.log(`Retrieving hardware token for building: ${buildingId}`);
  return null;
}
