/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        const coreApiUrl =
            process.env.CORE_API_URL ||
            process.env.NEXT_PUBLIC_CORE_API_URL ||
            "https://core:4000";

        return [
            {
                source: "/api/telemetry/:path*",
                destination: `${coreApiUrl}/api/telemetry/:path*`,
            },
        ];
    },
};

export default nextConfig;