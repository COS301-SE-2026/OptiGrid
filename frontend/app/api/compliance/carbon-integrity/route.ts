import { proxyCore } from "@/lib/coreProxy";

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();
    for (const field of ["building_id", "month"]) {
        const value = requestUrl.searchParams.get(field);
        if (value) query.set(field, value);
    }
    return proxyCore(request, {
        path: "/api/compliance/carbon-integrity",
        query,
        successMessage: "Carbon ledger verified.",
        failureMessage: "Carbon ledger verification failed.",
        unreachableMessage: "Unable to reach the compliance service."
    });
}
