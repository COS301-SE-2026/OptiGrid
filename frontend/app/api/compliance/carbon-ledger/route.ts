import { proxyCore } from "@/lib/coreProxy";

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const query = new URLSearchParams();
    for (const field of ["building_id", "month"]) {
        const value = requestUrl.searchParams.get(field);
        if (value) query.set(field, value);
    }
    return proxyCore(request, {
        path: "/api/compliance/carbon-ledger",
        query,
        successMessage: "Carbon ledger loaded.",
        failureMessage: "Carbon ledger lookup failed.",
        unreachableMessage: "Unable to reach the compliance service."
    });
}
