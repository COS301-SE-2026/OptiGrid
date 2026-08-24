# System Health Dashboard API

The system health endpoint supplies the admin dashboard with a single operational snapshot. It combines live dependency checks, ingestion activity, queue depth, process and database uptime, and recent structured failure records.

## Endpoint

```http
GET /api/admin/health
Authorization: Bearer <access-token>
```

Only authenticated users with the `ADMIN` role may call this endpoint. The public `GET /health` route remains a lightweight liveness probe and does not return operational details.

Interactive documentation is available at `/api-docs` while the core service is running.

## Query parameters

| Parameter | Type | Default | Limits | Effect |
| --- | --- | ---: | --- | --- |
| `window_minutes` | integer | `15` | `1`–`60` | Selects the UTC minute buckets used to calculate ingestion totals and rates. |
| `failure_limit` | integer | `50` | `1`–`100` | Limits the newest failure audit records returned. |
| `building_id` | UUID | none | Valid UUID | Filters ingestion counters and failure records to one building. |
| `user_id` | UUID | none | Valid UUID | Filters failure records to one user. Ingestion counters are not user-scoped. |

Example:

```bash
curl --get "http://localhost:4000/api/admin/health" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --data-urlencode "window_minutes=15" \
  --data-urlencode "failure_limit=25" \
  --data-urlencode "building_id=11111111-1111-4111-8111-111111111111"
```

## Operational status

The HTTP response is `200 OK` whenever a snapshot can be assembled. Consumers must inspect the top-level `status` field rather than treating HTTP 200 as proof that every dependency is operational.

| Status | Meaning |
| --- | --- |
| `healthy` | PostgreSQL, Redis, and InfluxDB are reachable and all dashboard data sources responded. |
| `degraded` | PostgreSQL is reachable, but Redis, InfluxDB, ingestion metrics, failure logs, or the PostgreSQL uptime query is unavailable. |
| `unhealthy` | PostgreSQL is unreachable. |

Every dependency includes its own `status`, check latency, and timestamp. Failure messages are deliberately sanitized and never include connection strings, tokens, payloads, or stack traces.

## Response example

```json
{
  "status": "healthy",
  "generatedAt": "2026-08-24T10:15:34.000Z",
  "application": {
    "uptimeSeconds": 9234
  },
  "filters": {
    "buildingId": "11111111-1111-4111-8111-111111111111",
    "userId": null
  },
  "dependencies": {
    "database": {
      "status": "up",
      "latencyMs": 3.18,
      "checkedAt": "2026-08-24T10:15:34.000Z",
      "uptimeSeconds": 86432
    },
    "redis": {
      "status": "up",
      "latencyMs": 1.42,
      "checkedAt": "2026-08-24T10:15:34.000Z",
      "queueDepth": 12
    },
    "influx": {
      "status": "up",
      "latencyMs": 5.71,
      "checkedAt": "2026-08-24T10:15:34.000Z"
    }
  },
  "ingestion": {
    "available": true,
    "windowMinutes": 15,
    "accepted": 298,
    "failed": 2,
    "total": 300,
    "requestsPerMinute": 20,
    "failureRatePercent": 0.67,
    "buckets": [
      {
        "minute": "2026-08-24T10:15:00.000Z",
        "accepted": 19,
        "failed": 1
      }
    ]
  },
  "failures": {
    "available": true,
    "count": 1,
    "items": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "buildingId": "11111111-1111-4111-8111-111111111111",
        "userId": null,
        "service": "ingestion-worker",
        "operation": "write-to-influx",
        "severity": "error",
        "errorCode": "INFLUX_WRITE_FAILED",
        "requestId": "request-01",
        "target": "energy_telemetry",
        "metadata": {
          "message": "InfluxDB write failed",
          "sensor_id": "sensor-01"
        },
        "timestamp": "2026-08-24T10:14:52.000Z"
      }
    ]
  }
}
```

When ingestion metrics or failure logs cannot be read, the relevant object returns `available: false`, an empty result, and a sanitized `message`. This allows the dashboard to render the remaining data during a partial outage.

## Data sources

- PostgreSQL connectivity uses `SELECT 1`; uptime uses `pg_postmaster_start_time()`.
- Redis supplies ingestion queue depth and per-minute accepted/failed counters.
- InfluxDB supplies its native health result.
- PostgreSQL audit logs supply persisted `SYSTEM_FAILURE` records emitted by distributed workers.

Ingestion counters are retained in Redis for the configured ingestion-metrics retention period. A requested window can therefore contain empty buckets if it exceeds available retained data or no requests occurred during those minutes.

## Error responses

| HTTP status | Meaning |
| ---: | --- |
| `400` | A query value is invalid or outside its allowed range. |
| `401` | The bearer token is missing, malformed, expired, or otherwise invalid. |
| `403` | The authenticated user is not an administrator. |
| `429` | The caller exceeded the endpoint rate limit. |
| `500` | The server could not assemble a dashboard snapshot. |
