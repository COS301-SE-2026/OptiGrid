const INGESTION_URL = process.env.INGESTION_API_URL || "http://ingestion-api:8000/ingest"

export const forwardToIngestionService = async (data: any): Promise<any> => {
    const response = await fetch(INGESTION_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    if(!response.ok)
        throw new Error(`Ingestion API responded with status: ${response.status}`);
    return await response.json();
}