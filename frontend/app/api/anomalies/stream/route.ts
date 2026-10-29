import { proxyEventStream } from "@/lib/eventStreamProxy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyEventStream(request, "/api/anomalies/stream", "anomaly");
}