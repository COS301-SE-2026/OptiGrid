// Exercise the real HTTP app/route/controller; unrelated scheduled jobs are outside
// this isolated telemetry scalability experiment. No route or auth is replaced.
const { createApp } = require('/app/backend/core/dist/src/app.js');
const server = createApp(4000).listen(4000, '0.0.0.0', () => console.log('NFR real core HTTP app ready'));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
