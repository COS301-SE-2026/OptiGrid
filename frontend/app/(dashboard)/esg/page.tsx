'use client';

import { useState } from 'react';
import { LivingEnvironment } from '@/components/LivingEnvironment';

interface Building {
  id: string;
  name: string;
}


const BUILDINGS: Building[] = [
  { id: 'bld-001', name: 'college' },
  { id: 'bld-002', name: 'my house' },
  { id: 'bld-003', name: 'hillcrest' },
];

export default function EsgDashboardPage() {
  const [selectedId, setSelectedId] = useState<string>(BUILDINGS[0]?.id ?? '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              ESG Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Select a building to see its living environment.
            </p>
          </div>

          
          <div className="flex items-center gap-3">
            <label
              htmlFor="building-select"
              className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              Building
            </label>
            <select
              id="building-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {BUILDINGS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        {selectedId ? (
          <LivingEnvironment key={selectedId} buildingId={selectedId}/>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No buildings available.
          </div>
        )}
      </div>
    </div>
  );
}