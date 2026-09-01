import { InfluxDB } from '@influxdata/influxdb-client';
import { BucketsAPI, OrgsAPI } from '@influxdata/influxdb-client-apis';

const INFLUX_URL = process.env.INFLUX_URL || process.env.INFLUXDB_URL || 'http://influxdb:8086';
const INFLUX_TOKEN = process.env.INFLUXDB_TOKEN || '';
const INFLUX_ORG = process.env.INFLUXDB_ORG || 'OptiGrid';
const DATA_RETENTION_DAYS = 30;

export async function queueBuildingProvisioning(
  buildingId: string,
  buildingName: string,
  nominalVoltage: number,
  maxCurrentThreshold: number,
  hardwareAuthToken: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  console.log(`PROVISIONING: gonna provision building- ${buildingId} ${buildingName}`);
  const bucketName = await provisionInfluxDBBucket(buildingId, buildingName, nominalVoltage, maxCurrentThreshold);
  await initializeIngestionService(buildingId, hardwareAuthToken, nominalVoltage, maxCurrentThreshold, bucketName, metadata);
  await initializeAnalyticsService(buildingId, buildingName);
}


async function provisionInfluxDBBucket(
  buildingId: string,
  buildingName: string,
  nominalVoltage: number,
  maxCurrentThreshold: number
): Promise<string> {
  const bucketName = `building-${buildingId}`;
  const retentionSeconds = DATA_RETENTION_DAYS * 24 * 3600;

  try {
    const influxClient = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    const bucketsAPI = new BucketsAPI(influxClient);
    //const buckets = await bucketsAPI.getBuckets();
    const orgs = new OrgsAPI(influxClient);
    const orgsResp = await orgs.getOrgs({
      org: INFLUX_ORG
    });

    if (!orgsResp.orgs || orgsResp.orgs.length == 0) throw new Error("Not found");
    const orgID = orgsResp.orgs[0].id;
    const bucketConfig = {
      orgID: orgID as string,
      name: bucketName,
      description: `Telemetry metrics for ${buildingName}`,
      retentionRules: [{
        type: 'expire' as const,
        everySeconds: retentionSeconds
      }]
    };

    try {
      await bucketsAPI.postBuckets({ body: bucketConfig });
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
  const ingestionUrl = (process.env.INGESTION_API_URL || 'http://ingestion-api:8000')
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
  } catch (error) {
    console.error(`[INGESTION] Failed to initialize ingestion for building ${buildingId}:`, error);
    throw new Error(`Ingestion initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function initializeAnalyticsService(
  buildingId: string,
  buildingName: string
): Promise<void> {
  const analyticsUrl = (process.env.ANALYTICS_API_URL || 'http://analytics:5001')
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
  } catch (error) {
    console.error(`[ANALYTICS] Failed to initialize analytics for building ${buildingId}:`, error);
    throw new Error(`Analytics initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getHardwareAuthToken(buildingId: string): Promise<string | null> {
  console.log(`Retrieving hardware token for building: ${buildingId}`);
  return null;
}

// this function ensures that when we delete a building 
//in frontend or supabase its deleted from influx as well
export async function deleteInfluxBucket(buildingId: string): Promise<void> {
  const bucket = `building-${buildingId}`;
  try {
    const influxClient = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
    const bucketsAPI = new BucketsAPI(influxClient);

    const allBuckets = await bucketsAPI.getBuckets({
      name: bucket
    });
    if (allBuckets.buckets && allBuckets.buckets.length > 0) {
      await bucketsAPI.deleteBucketsID({
        bucketID: allBuckets.buckets[0].id as string
      });
    }
  }
  catch (error) {
    console.error(`Failed to delete bucket ${bucket}: `, error);
  }
}
