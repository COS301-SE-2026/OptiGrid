/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        const coreApiUrl =
            process.env.CORE_URL ||
            process.env.NEXT_PUBLIC_CORE_API_URL ||
            "http://core:4000"; // NOSONAR

        return [
            {
                source: "/api/telemetry/live",
                destination: `${coreApiUrl}/api/telemetry/live`,
            },
        ];
    },
};

export default nextConfig;
