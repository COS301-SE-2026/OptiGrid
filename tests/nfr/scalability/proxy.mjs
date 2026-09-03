import http from 'node:http';
import { promises as dns } from 'node:dns';
const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });
let upstreams = [];
let cursor = 0;
let refreshAt = 0;
let refresh;
let buckets = new Map();
let perUpstream = {};
let total = 0;
async function discover() {
  if (Date.now() < refreshAt && upstreams.length) return;
  if (!refresh) refresh = dns.resolve4('ingestion-api').then(ips => { upstreams = [...new Set(ips)].sort(); refreshAt = Date.now() + 1000; }).finally(() => { refresh = undefined; });
  await refresh;
}
const server = http.createServer(async (req, res) => {
  if (req.url === '/_nfr/metrics') {
    await discover().catch(() => {});
    const now = Math.floor(Date.now() / 1000);
    const recent = [...buckets.entries()].filter(([second]) => second >= now - 10 && second < now);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ now: Date.now(), total, requestRate10s: recent.reduce((n, [, count]) => n + count, 0) / 10, upstreams, perUpstream }));
    return;
  }
  if (req.url === '/_nfr/reset' && req.method === 'POST') {
    buckets = new Map(); perUpstream = {}; total = 0;
    res.end('reset'); return;
  }
  if (req.url === '/ingest' && req.method === 'POST') {
    total++;
    const second = Math.floor(Date.now() / 1000);
    buckets.set(second, (buckets.get(second) ?? 0) + 1);
    for (const key of buckets.keys()) if (key < second - 30) buckets.delete(key);
  }
  try {
    await discover();
    const host = upstreams[cursor++ % upstreams.length];
    if (!host) throw new Error('No ingestion replicas available');
    const forwarded = http.request({ hostname: host, port: 8000, path: req.url, method: req.method, headers: { ...req.headers, host: `${host}:8000` }, agent, timeout: 10000 }, upstream => {
      perUpstream[host] ??= { requests: 0, accepted: 0 };
      perUpstream[host].requests++;
      if (upstream.statusCode === 201) perUpstream[host].accepted++;
      res.writeHead(upstream.statusCode, { ...upstream.headers, 'x-nfr-upstream': host });
      upstream.pipe(res);
    });
    forwarded.on('timeout', () => forwarded.destroy(new Error('Ingestion timeout')));
    forwarded.on('error', error => { if (!res.headersSent) res.writeHead(502); res.end(JSON.stringify({ status: 'error', message: error.message })); });
    req.pipe(forwarded);
  } catch (error) {
    res.writeHead(503); res.end(JSON.stringify({ status: 'error', message: error.message }));
  }
});
server.listen(8080, '0.0.0.0');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
