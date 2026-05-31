import os
import time
import signal
import json
import redis
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

running = True

#handle shut down signals (like ctrl + c or docker stop)
def stop_worker(signum, _frame):
    global running
    print(f"[ingestion worker] Received signal {signum}, spinning down")
    running = False
    
def main() -> None:
    #Register signal handlers for shutdown
    signal.signal(signal.SIGINT, stop_worker)
    signal.signal(signal.SIGTERM, stop_worker)
    
    #get connection env variables
    redis_host = os.getenv("REDIS_HOST", "optigrid_redis")
    influx_url = os.getenv("INFLUXDB_URL", "http://optigrid_influxdb:8086")
    influx_token = os.getenv("INFLUXDB_TOKEN", "token-1234")
    influx_org = os.getenv("INFLUXDB_ORG", "OptiGrid")
    influx_bucket = os.getenv("INFLUXDB_BUCKET", "EnergyData")
    
    print(f"[ingestion-worker] Initialising connections: Redis -> {redis_host} | InfluxDB -> {influx_url}")
    #connect to redis and influx
    r = redis.Redis(host=redis_host, port=6379, db=0, decode_responses=True)
    influx_client = InfluxDBClient(url=influx_url, token=influx_token, org=influx_org)
    write_api = influx_client.write_api(write_options=SYNCHRONOUS)
    print(f"[ingestion-worker] Pipeline established. Processing ingestion queue...")

    #will keep running until stopped manually
    while running:
        try:
            #blocking pop from redis queue
            packed_message = r.brpop("ingestion_queue", timeout=2)
            if packed_message:
                _, raw_json = packed_message #unpack (queue_name, data)
                payload = json.loads(raw_json)
                
                #telemetry fields for InfluxDB tags
                sensor_id = payload.get("sensor_id", "unknown_sensor")
                building_id = payload.get("building_id", "unknown_building")
                meter_id = payload.get("meter_id", "unknown_meter")

                # convert usage string to float (handles errors)
                try:
                    usage_kwh = float(payload.get("usage", 0.0))
                except (ValueError, TypeError):
                    usage_kwh = 0.0

                # extract and convert cost string to float
                try:
                    raw_cost = str(payload.get("cost", "$0.00"))
                    cost_usd = float(raw_cost.replace("$", "").replace(",", ""))
                except (ValueError, TypeError):
                    cost_usd = 0.0

                # constructing InfluxDB Timeseries Point with tags and multiple fields
                point = Point("energy_consumption") \
                    .tag("sensor_id", sensor_id) \
                    .tag("building_id", building_id) \
                    .tag("meter_id", meter_id) \
                    .tag("reading_type", payload.get("type", "Commercial")) \
                    .field("usage_kwh", usage_kwh) \
                    .field("cost_usd", cost_usd)
                
                # write to influx
                write_api.write(bucket=influx_bucket, org=influx_org, record=point)
                print(f"[ingestion-worker] Processed telemetry point -> {sensor_id}: Usage: {usage_kwh}kWh, Cost: ${cost_usd}")
        except redis.exceptions.ConnectionError:
            print("[ingestion-worker] Lost database connection. Re trying in 5s...")
            time.sleep(5)
        except Exception as e:
            print(f"[ingestion-worker] Error: {e}")
            
    #cleanup on shutdown
    print("[ingestion-worker] Disconnecting system integration hooks")
    influx_client.close()
    print("[ingestion-worker] System stopped.")
        
if __name__ == "__main__":
    main()
