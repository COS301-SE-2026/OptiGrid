import 'dotenv/config';

import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	// Allow local installs/tests to run even when DATABASE_URL is not set yet.
	datasource: {
		url: process.env.DATABASE_URL ?? 'postgresql://dummy:dummy@localhost:5432/dummy',
	},
});
