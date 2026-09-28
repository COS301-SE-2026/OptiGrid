'use client';

import { useState, useEffect } from 'react';
import { LivingEnvironment } from '@/components/LivingEnvironment';
import { useBuildings } from '@/lib/useBuildings';
import { rankByUsage } from '@/lib/rankBuildings';

export default function EsgDashboardPage() {
  const { data: buildings, isLoading, isError } = useBuildings();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (buildings && buildings.length > 0 && !selectedId) {
      setSelectedId(rankByUsage(buildings)[0].id);
    }
  }, [buildings, selectedId]);

  const selected = buildings?.find((b) => b.id === selectedId);

  if (isLoading) {
    return <p className="text-muted">Loading buildings...</p>;
  }

  if (isError) {
    return <p className="text-muted">Error loading buildings.</p>;
  }

  return (
    <div>
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">ESG Dashboard</h1>
          <p className="dashboard-subtitle">
            Select a building to see its living environment respond in real
            time.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 4 }}>
          <label className="label" htmlFor="building-select" style={{ marginBottom: 0 }}>
            Building
          </label>
          <select
            id="building-select"
            className="select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ minWidth: 240 }}
          >
            {buildings?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {selected ? (
        <LivingEnvironment key={selected.id} buildingId={selected.id} buildingName={selected.name} />
      ) : (
        <div className="card dashboard-empty">
          <p className="text-muted">No buildings available.</p>
        </div>
      )}
    </div>
  );
}