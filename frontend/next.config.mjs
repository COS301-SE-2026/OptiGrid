/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: "/api/telemetry/live",
                destination: "http://core:4000/api/telemetry/live",
            },
        ];
    },
};

export default nextConfig;
