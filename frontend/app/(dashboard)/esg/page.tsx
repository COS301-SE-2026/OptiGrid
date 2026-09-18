'use client';

import { useState } from 'react';
import { LivingEnvironment } from '@/components/LivingEnvironment';

interface Building {
  id: string;
  name: string;
  location?: string;
}


const BUILDINGS: Building[] = [
  { id: 'b1', name: 'My house', location: 'Johannesburg' },
  { id: 'b2', name: 'Office', location: 'Cape Town' },
  { id: 'b3', name: 'leonardo', location: 'Durban' },
];

export default function EsgDashboardPage() {
  const [selectedId, setSelectedId] = useState<string>(BUILDINGS[0]?.id ?? '');
  const selected = BUILDINGS.find((b) => b.id === selectedId);

  return (
    <div className="dashboard-page">
      <div className="dashboard-shell">
        <main className="dashboard-main">
          <header className="dashboard-header">
            <div>
              <p className="landing-kicker">Environmental · Social · Governance</p>
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
                  {BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.location ? ` — ${b.location}` : ''}
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