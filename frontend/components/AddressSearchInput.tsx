import React, { useState } from "react";

interface AddressInput {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onCoordinatesFound: (lat: number, lon: number) => void;
    disabled?: boolean;
    error?: boolean;
}

export function AddressSearchInput({ value, onChange, onCoordinatesFound, disabled, error }: AddressInput) {
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const errorStyle = {
        borderColor: "var(--brand-danger)",
        boxShadow: "0 0 0 2px var(--brand-bg), 0 0 0 4px var(--brand-danger)",
    };

    const handleSearch = async () => {
        if(!value.trim()) {
            setSearchError("Please enter an address to search");
            return;
        }
        setSearchError("");
        setSearching(true);
        try{
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=1`, {
                headers: {
                    "User-Agent": "OptiGrid-Frontend-Geocoding"
                }
            });
            if(!resp.ok) throw new Error("Search failed");

            const data = await resp.json();
            if(data && data.length > 0) {
                onCoordinatesFound(Number(data[0].lat), Number(data[0].lon));
                setSearchError("");
            }
            else setSearchError("Address not found");
        }
        catch(err) {
            setSearchError("Error searching address");
        }
        finally {
            setSearching(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <input
                    id="physical_address"
                    name="physical_address"
                    type="text"
                    className="input"
                    value={value}
                    onChange={(e) => {
                        onChange(e);
                        if (searchError) setSearchError("");
                    }}
                    disabled={disabled || searching}
                    placeholder="1 Maude St, Sandton, 2196"
                    style={{ flex: 1, ...(error ? errorStyle : {}) }}
                />
                <button
                    type="button"
                    onClick={handleSearch}
                    disabled={disabled || searching || !value.trim()}
                    className="btn btn-secondary"
                    style={{ whiteSpace: "nowrap" }}
                >
                    {searching ? "Searching..." : "Validate"}
                </button>
            </div>
            {searchError && (
                <p role="alert" style={{ color: "var(--brand-danger)", fontSize: "var(--fs-small)" }}>{searchError}</p>
            )}
        </div>
    );
}
