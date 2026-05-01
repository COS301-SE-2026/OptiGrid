import os
import signal
import time

running = True


def stop_worker(signum, _frame):
    global running
    print(f"[ingestion-worker] received signal {signum}, shutting down...")
    running = False


def main() -> None:
    signal.signal(signal.SIGINT, stop_worker)
    signal.signal(signal.SIGTERM, stop_worker)

    interval_seconds = int(os.getenv("INGESTION_TICK_SECONDS", "10"))
    influx_bucket = os.getenv("INFLUXDB_BUCKET", "unset")
    influx_org = os.getenv("INFLUXDB_ORG", "unset")

    print(
        f"[ingestion-worker] started (tick={interval_seconds}s, bucket={influx_bucket}, org={influx_org})"
    )
    while running:
        print("[ingestion-worker] idle cycle complete")
        time.sleep(interval_seconds)

    print("[ingestion-worker] stopped")


if __name__ == "__main__":
    main()
