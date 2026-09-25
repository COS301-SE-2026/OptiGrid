'use client';

import { useState, useEffect } from 'react';
import { LivingEnvironment } from '@/components/LivingEnvironment';
import { useBuildings } from '@/lib/useBuildings';

export default function EsgDashboardPage() {
  const { data: buildings, isLoading, isError } = useBuildings();
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    if (buildings && buildings.length > 0 && !selectedId) {
      setSelectedId(buildings[0].id);
    }
  }, [buildings, selectedId]);

  const selected = buildings?.find((b) => b.id === selectedId);

  if (isLoading) {
    return <div className="dashboard-page"><div className="dashboard-shell"><main className="dashboard-main"><p>Loading buildings...</p></main></div></div>;
  }
  
  if (isError) {
    return <div className="dashboard-page"><div className="dashboard-shell"><main className="dashboard-main"><p>Error loading buildings.</p></main></div></div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <main className="dashboard-main">
          <header className="dashboard-header">
            <div>
              <p className="landing-kicker">Environmental</p>
              <h1 className="dashboard-title">ESG Dashboard</h1>
              <p className="dashboard-subtitle">
                Select a building to see its living environment respond in real
                time.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <label className="label" htmlFor="building-select">
                  Building
                </label>
                <select
                  id="building-select"
                  className="select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  style={{ minWidth: 220 }}
                >
                  {buildings?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          {selected ? (
            <LivingEnvironment key={selected.id} buildingId={selected.id} />
          ) : (
            <div className="card dashboard-empty">
              <p className="text-muted">No buildings available.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}