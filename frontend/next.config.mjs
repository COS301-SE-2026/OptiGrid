/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        const coreApiUrl = process.env.CORE_URL || "http://core:4000"; // NOSONAR

        return [
            {
                source: "/api/telemetry/live",
                destination: `${coreApiUrl}/api/telemetry/live`,
            },
        ];
    },
};

export default nextConfig;
