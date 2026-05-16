const INGESTION_URL = process.env.INGESTION_API_URL || "https://localhost:8000/ingestion"

export const forwardToIngestion = async (data: any) => {
    const response = await fetch(INGESTION_URL, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    });

    if(!response.ok)
        throw new Error(`Ingestion API responded with status: ${response.status}`);
    return await response.json();
}