'use client';

import { useId, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchEsgHealthScore, simulateEsgScenario } from '@/lib/esg';

type EcosystemState = 'thriving' | 'healthy' | 'declining' | 'critical';

function getEcosystemState(score: number): EcosystemState {
  if (score >= 80) return 'thriving';
  if (score >= 60) return 'healthy';
  if (score >= 40) return 'declining';
  return 'critical';
}

const stateConfig: Record<
  EcosystemState,
  {
    label: string;
    badgeClass: string;
    bgFrom: string;
    bgTo: string;
    trunkColor: string;
    trunkHighlight: string;
    leafColors: [string, string, string];
    flowerColor: string;
    flowerCenter: string;
    grassColor: string;
    grassHighlight: string;
    sunColor: string;
    sunGlow: string;
    leafCount: number;
    flowerCount: number;
  }
> = {
  thriving: {
    label: 'Thriving',
    badgeClass: 'badge-success',
    bgFrom: '#EEF7FF',
    bgTo: '#CDE8E5',
    trunkColor: '#3D6C7E',
    trunkHighlight: '#4D869C',
    leafColors: ['#2F7D5D', '#4D869C', '#7AB2B2'],
    flowerColor: '#7AB2B2',
    flowerCenter: '#EEF7FF',
    grassColor: '#2F7D5D',
    grassHighlight: '#7AB2B2',
    sunColor: '#F4C95D',
    sunGlow: 'rgba(244, 201, 93, 0.55)',
    leafCount: 24,
    flowerCount: 8,
  },
  healthy: {
    label: 'Healthy',
    badgeClass: 'badge-default',
    bgFrom: '#EEF7FF',
    bgTo: '#DDE9F2',
    trunkColor: '#4D869C',
    trunkHighlight: '#7AB2B2',
    leafColors: ['#4D869C', '#7AB2B2', '#A8D0D0'],
    flowerColor: '#7AB2B2',
    flowerCenter: '#EEF7FF',
    grassColor: '#4D869C',
    grassHighlight: '#7AB2B2',
    sunColor: '#EBCB72',
    sunGlow: 'rgba(235, 203, 114, 0.45)',
    leafCount: 18,
    flowerCount: 4,
  },
  declining: {
    label: 'Declining',
    badgeClass: 'badge-warning',
    bgFrom: '#FBF6EA',
    bgTo: '#F0E1C4',
    trunkColor: '#8A6A3B',
    trunkHighlight: '#B26B00',
    leafColors: ['#B26B00', '#C68B3A', '#D9B679'],
    flowerColor: '#D9B679',
    flowerCenter: '#FBF6EA',
    grassColor: '#8A6A3B',
    grassHighlight: '#C68B3A',
    sunColor: '#E0A24A',
    sunGlow: 'rgba(224, 162, 74, 0.4)',
    leafCount: 10,
    flowerCount: 1,
  },
  critical: {
    label: 'Critical',
    badgeClass: 'badge-danger',
    bgFrom: '#FBE9E9',
    bgTo: '#E7C9C9',
    trunkColor: '#5C3A2E',
    trunkHighlight: '#8A5343',
    leafColors: ['#8A5343', '#B03A3A', '#7A4A3E'],
    flowerColor: '#B03A3A',
    flowerCenter: '#FBE9E9',
    grassColor: '#8A6A3B',
    grassHighlight: '#B03A3A',
    sunColor: '#B03A3A',
    sunGlow: 'rgba(176, 58, 58, 0.35)',
    leafCount: 4,
    flowerCount: 0,
  },
};

const WEIGHTS = {
  energyEfficiency: 0.35,
  renewables: 0.3,
  hvacLoad: 0.2,
  lighting: 0.15,
};

interface LivingEnvironmentProps {
  buildingId: string;
}

export function LivingEnvironment({ buildingId }: LivingEnvironmentProps) {
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < buildingId.length; i++) {
      h = (h * 31 + buildingId.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }, [buildingId]);

  const [energyEfficiency, setEnergyEfficiency] = useState(60 + (seed % 40));
  const [renewables, setRenewables] = useState(55 + ((seed >> 3) % 45));
  const [hvacLoad, setHvacLoad] = useState(55 + ((seed >> 6) % 40));
  const [lighting, setLighting] = useState(60 + ((seed >> 9) % 40));
  const [impact, setImpact] = useState<{ totalCarbonAvoided: number, equivalentTrees: number } | null>(null);
  const [baseline, setBaseline] = useState<{ energyEfficiency: number, renewables: number, hvacLoad: number, lighting: number } | null>(null);

  useEffect(() => {
    fetchEsgHealthScore(buildingId)
      .then((data) => {
        const getScore = (dim: string) => data.dimensions.find((d: { dimension: string; score: number }) => d.dimension === dim)?.score || 60;
        const base = {
          energyEfficiency: getScore('energy_efficiency'),
          renewables: getScore('renewables'),
          hvacLoad: getScore('hvacLoad'),
          lighting: getScore('lighting'),
        };
        setBaseline(base);
        setEnergyEfficiency(base.energyEfficiency);
        setRenewables(base.renewables);
        setHvacLoad(base.hvacLoad);
        setLighting(base.lighting);
      })
      .catch(console.error);
  }, [buildingId]);

  const handleReset = () => {
    if (baseline) {
      setEnergyEfficiency(baseline.energyEfficiency);
      setRenewables(baseline.renewables);
      setHvacLoad(baseline.hvacLoad);
      setLighting(baseline.lighting);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      simulateEsgScenario(buildingId, { energyEfficiency, renewables, hvacLoad, lighting })
        .then((res) => setImpact(res.impact))
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [buildingId, energyEfficiency, renewables, hvacLoad, lighting]);

  const healthScore = useMemo(() => {
    const raw =
      energyEfficiency * WEIGHTS.energyEfficiency +
      renewables * WEIGHTS.renewables +
      hvacLoad * WEIGHTS.hvacLoad +
      lighting * WEIGHTS.lighting;
    return Math.round(Math.max(0, Math.min(100, raw)));
  }, [energyEfficiency, renewables, hvacLoad, lighting]);

  const state = getEcosystemState(healthScore);
  const config = stateConfig[state];

  const drivers = useMemo(
    () => buildDrivers({ energyEfficiency, renewables, hvacLoad, lighting }),
    [energyEfficiency, renewables, hvacLoad, lighting]
  );

  return (
    <div
      className="esg-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)',
        gap: 'var(--space-5)',
        alignItems: 'start',
      }}
    >
      
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="dashboard-section-header"
            style={{
              padding: 'var(--space-4) var(--space-5) 0',
              marginBottom: 0,
            }}
          >
            <div>
              <h2 className="dashboard-section-title">Living Environment</h2>
              <p className="dashboard-section-meta">
                Building <span className="metric">{buildingId}</span>
              </p>
            </div>
            <span className={`badge ${config.badgeClass}`}>
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'currentColor',
                  display: 'inline-block',
                }}
              />
              {config.label}
            </span>
          </div>

          <EcosystemVisual
            state={state}
            config={config}
            buildingId={buildingId}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: impact ? 'repeat(5, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
              gap: 'var(--space-3)',
              padding: 'var(--space-4) var(--space-5) var(--space-5)',
              borderTop: '1px solid var(--brand-border)',
            }}
          >
            <TreeStat
              label="Health Score"
              value={`${healthScore}`}
              accent={config.badgeClass}
            />
            <TreeStat
              label="Leaves"
              value={`${config.leafCount}/24`}
              accent={config.badgeClass}
            />
            <TreeStat
              label="Bloom"
              value={`${config.flowerCount}/8`}
              accent={config.badgeClass}
            />
            {impact && (
              <>
                <TreeStat
                  label="CO2 Saved"
                  value={`${impact.totalCarbonAvoided}kg`}
                  accent="badge-success"
                />
                <TreeStat
                  label="Trees Eq"
                  value={`${impact.equivalentTrees}`}
                  accent="badge-success"
                />
              </>
            )}
          </div>
        </section>

        <WhatIsAffectingPanel
          drivers={drivers}
          healthScore={healthScore}
          state={state}
        />
      </div>

      
      <section
        className="card"
        style={{ position: 'sticky', top: 'var(--space-5)' }}
      >
        <header
          className="dashboard-section-header"
          style={{ 
            marginBottom: 'var(--space-4)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start' 
          }}
        >
          <div>
            <h2 className="dashboard-section-title">Building Performance</h2>
            <p className="dashboard-section-meta">
              Move a slider, the tree responds instantly.
            </p>
          </div>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={!baseline || (energyEfficiency === baseline.energyEfficiency && renewables === baseline.renewables && hvacLoad === baseline.hvacLoad && lighting === baseline.lighting)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              fontSize: '12px',
              opacity: (!baseline || (energyEfficiency === baseline.energyEfficiency && renewables === baseline.renewables && hvacLoad === baseline.hvacLoad && lighting === baseline.lighting)) ? 0.5 : 1
            }}
          >
            Reset to Baseline
          </button>
        </header>

        <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
          <ControlSlider
            label="Energy Efficiency"
            value={energyEfficiency}
            onChange={setEnergyEfficiency}
            accent="--brand-primary"
          />
          <ControlSlider
            label="Renewable Energy"
            value={renewables}
            onChange={setRenewables}
            accent="--brand-secondary"
          />
          <ControlSlider
            label="HVAC Optimization"
            value={hvacLoad}
            onChange={setHvacLoad}
            accent="--brand-success"
          />
          <ControlSlider
            label="Lighting Optimization"
            value={lighting}
            onChange={setLighting}
            accent="--brand-primary"
          />
        </div>

        <div
          className="dashboard-section-meta"
          style={{
            marginTop: 'var(--space-5)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--brand-border)',
          }}
        >
          Weightage - efficiency 35% · renewables 30% · HVAC 20% ·
          lighting 15%.
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 980px) {
          .esg-layout {
            grid-template-columns: 1fr !important;
          }
          .esg-layout > section.card {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}


interface SliderInputs {
  energyEfficiency: number;
  renewables: number;
  hvacLoad: number;
  lighting: number;
}

interface Driver {
  key: keyof SliderInputs;
  label: string;
  value: number;
  weight: number;
  impact: number;
  tone: 'positive' | 'neutral' | 'negative';
  explanation: string;
}

function buildDrivers(inputs: SliderInputs): Driver[] {
  const rows: Omit<Driver, 'impact' | 'tone'>[] = [
    {
      key: 'energyEfficiency',
      label: 'Energy Efficiency',
      value: inputs.energyEfficiency,
      weight: WEIGHTS.energyEfficiency,
      explanation:
        'Overall energy performance of the building.',
    },
    {
      key: 'renewables',
      label: 'Renewable Energy',
      value: inputs.renewables,
      weight: WEIGHTS.renewables,
      explanation:
        'Share of the buildings consumption covered by clean sources.',
    },
    {
      key: 'hvacLoad',
      label: 'HVAC Optimization',
      value: inputs.hvacLoad,
      weight: WEIGHTS.hvacLoad,
      explanation:
        'How well heating, ventilation and cooling is tuned to demand.',
    },
    {
      key: 'lighting',
      label: 'Lighting Optimization',
      value: inputs.lighting,
      weight: WEIGHTS.lighting,
      explanation:
        'lighting and daylight harvesting effectiveness.',
    },
  ];

  return rows
    .map((r) => {
      const impact = r.value * r.weight;
      const tone: Driver['tone'] =
        r.value >= 70 ? 'positive' : r.value >= 45 ? 'neutral' : 'negative';
      return { ...r, impact, tone };
    })
    .sort((a, b) => a.value - b.value);
}

function WhatIsAffectingPanel({
  drivers,
  healthScore,
  state,
}: {
  drivers: Driver[];
  healthScore: number;
  state: EcosystemState;
}) {
  const weakest = drivers[0];

  return (
    <section className="card" aria-labelledby="affecting-heading">
      <header
        className="dashboard-section-header"
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <div>
          <h2 id="affecting-heading" className="dashboard-section-title">
            Description of what is affecting the tree.
          </h2>
          <p className="dashboard-section-meta">
            Weakest signals first.
          </p>
        </div>
      </header>

      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {drivers.map((d, idx) => (
          <DriverBar key={d.key} driver={d} rank={idx + 1} />
        ))}
      </div>

      <div
        style={{
          marginTop: 'var(--space-4)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--brand-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap',
          fontSize: 'var(--fs-small)',
        }}
      >
        <span className="dashboard-section-meta">
          Score <span className="metric">{healthScore}</span> <div className=""></div> tree is{' '}
          <strong>{state}</strong>
        </span>
        <span className="dashboard-section-meta">
          Weakest:{' '}
          <strong style={{ color: 'var(--brand-ink)' }}>{weakest.label}</strong>
        </span>
      </div>
    </section>
  );
}





function CascadeRow({ driver, isLast }: { driver: Driver; isLast: boolean }) {
  const tone = toneStyle[driver.tone];
  const pct = Math.round(driver.value);

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        gap: 'var(--space-3)',
        alignItems: 'start',
      }}
    >
      
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 4,
          height: '100%',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: tone.barColor,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${tone.barColor} 20%, transparent)`,
            flexShrink: 0,
          }}
        />
        {!isLast && (
          <span
            aria-hidden
            style={{
              width: 1,
              flex: 1,
              minHeight: 18,
              background: 'var(--brand-border)',
              marginTop: 4,
            }}
          />
        )}
      </div>

      <div style={{ display: 'grid', gap: 4, paddingBottom: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontWeight: 'var(--fw-semibold)',
              fontSize: '0.9rem',
              color: 'var(--brand-ink)',
            }}
          >
            {driver.label}
          </span>
          <span
            className="metric"
            style={{
              fontSize: '0.9rem',
              color: tone.barColor,
              fontWeight: 'var(--fw-semibold)',
            }}
          >
            {pct}%
          </span>
        </div>

        <div
          style={{
            height: 4,
            borderRadius: 999,
            background:
              'color-mix(in srgb, var(--brand-secondary) 18%, transparent)',
            overflow: 'hidden',
            maxWidth: '100%',
          }}
        >
          <motion.div
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: tone.barColor,
            }}
          />
        </div>

        <span
          className="dashboard-section-meta"
          style={{ fontSize: '0.72rem', lineHeight: 1.5 }}
        >
          {driver.explanation}
        </span>
      </div>
    </li>
  );
}

function DriverTile({ driver }: { driver: Driver }) {
  const tone = toneStyle[driver.tone];
  const pct = Math.round(driver.value);
  const R = 22;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div
      style={{
        padding: 'var(--space-3)',
        border: '1px solid var(--brand-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--brand-surface)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 'var(--space-3)',
        alignItems: 'center',
      }}
    >
      
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke="color-mix(in srgb, var(--brand-secondary) 22%, transparent)"
          strokeWidth="4"
        />
        <motion.circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke={tone.barColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C - dash }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          transform="rotate(-90 28 28)"
        />
        <text
          x="28"
          y="32"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="12"
          fontWeight="600"
          fill="var(--brand-ink)"
        >
          {pct}
        </text>
      </svg>

      
      <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontWeight: 'var(--fw-semibold)',
            fontSize: '0.85rem',
            color: 'var(--brand-ink)',
          }}
        >
          {driver.label}
        </span>
        <span
          className={`badge ${tone.badge}`}
          style={{ justifySelf: 'start', marginTop: 2 }}
        >
          {tone.verb}
        </span>
      </div>
    </div>
  );
}

function DriverBar({ driver, rank }: { driver: Driver; rank: number }) {
  const tone = toneStyle[driver.tone];
  const pct = Math.round(driver.value);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            className="metric"
            style={{
              fontSize: 10,
              color: 'var(--brand-ink-muted)',
              minWidth: 14,
            }}
          >
            {String(rank).padStart(2, '0')}
          </span>
          <span
            style={{
              fontWeight: 'var(--fw-semibold)',
              fontSize: '0.9rem',
              color: 'var(--brand-ink)',
            }}
          >
            {driver.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            className="metric"
            style={{
              fontSize: '0.9rem',
              fontWeight: 'var(--fw-semibold)',
              color: tone.barColor,
            }}
          >
            {pct}%
          </span>
          <span
            className="dashboard-section-meta"
            style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            {tone.verb}
          </span>
        </div>
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${driver.label} at ${pct}%`}
        style={{
          position: 'relative',
          height: 10,
          borderRadius: 999,
          background:
            'color-mix(in srgb, var(--brand-secondary) 18%, transparent)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            background: `linear-gradient(90deg, color-mix(in srgb, ${tone.barColor} 55%, transparent), ${tone.barColor})`,
            borderRadius: 999,
          }}
        />
      </div>

      <span
        className="dashboard-section-meta"
        style={{ fontSize: '0.72rem', lineHeight: 1.5 }}
      >
        {driver.explanation}
      </span>
    </div>
  );
}
const toneStyle: Record<
  Driver['tone'],
  { badge: string; barColor: string; verb: string }
> = {
  positive: {
    badge: 'badge-success',
    barColor: 'var(--brand-success)',
    verb: 'Helping',
  },
  neutral: {
    badge: 'badge-default',
    barColor: 'var(--brand-primary)',
    verb: 'Holding',
  },
  negative: {
    badge: 'badge-danger',
    barColor: 'var(--brand-danger)',
    verb: 'Dragging',
  },
};

function DriverRow({ driver }: { driver: Driver }) {
  const tone = toneStyle[driver.tone];
  const pct = Math.round(driver.value);

  return (
    <div
      style={{
        padding: 'var(--space-3)',
        border: '1px solid var(--brand-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--brand-surface)',
        display: 'grid',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
          <span
            style={{
              fontWeight: 'var(--fw-semibold)',
              fontSize: '0.9rem',
              color: 'var(--brand-ink)',
            }}
          >
            {driver.label}
          </span>
          <span
            className="dashboard-section-meta"
            style={{ fontSize: '0.75rem' }}
          >
            {driver.explanation}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span className="metric" style={{ fontSize: '0.9rem' }}>
            {pct}%
          </span>
          <span className={`badge ${tone.badge}`}>{tone.verb}</span>
        </div>
      </div>

      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${driver.label} at ${pct}%`}
        style={{
          position: 'relative',
          height: 6,
          borderRadius: 999,
          background:
            'color-mix(in srgb, var(--brand-secondary) 22%, transparent)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: `${pct}%`,
            background: tone.barColor,
            borderRadius: 999,
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}


interface ControlSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
}

function ControlSlider({ label, value, onChange, accent }: ControlSliderProps) {
  const id = useId();
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <label className="label" htmlFor={id} style={{ marginBottom: 0 }}>
          {label}
        </label>
        <span
          className="metric"
          style={{
            fontSize: 'var(--fs-small)',
            color: `var(${accent})`,
            fontWeight: 'var(--fw-semibold)',
          }}
        >
          {value}%
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          height: 20,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '9px 0',
            borderRadius: 999,
            background:
              'color-mix(in srgb, var(--brand-secondary) 22%, transparent)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 9,
            bottom: 9,
            left: 0,
            width: `${value}%`,
            borderRadius: 999,
            background: `var(${accent})`,
            transition: 'width 0.1s linear',
          }}
        />
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: 20,
            appearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            margin: 0,
          }}
          className="esg-slider"
        />
      </div>

      <style jsx>{`
        .esg-slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: var(--brand-surface);
          border: 2px solid var(${accent});
          box-shadow: var(--shadow-card);
          transition: transform 0.15s ease;
        }
        .esg-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .esg-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: var(--brand-surface);
          border: 2px solid var(${accent});
          box-shadow: var(--shadow-card);
        }
        .esg-slider:focus-visible {
          outline: none;
        }
        .esg-slider:focus-visible::-webkit-slider-thumb {
          box-shadow: var(--focus-ring);
        }
      `}</style>
    </div>
  );
}


function TreeStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: 'var(--brand-surface-alt)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
        display: 'grid',
        gap: 2,
      }}
    >
      <span className="dashboard-kpi-label" style={{ fontSize: '0.62rem' }}>
        {label}
      </span>
      <span
        className={`metric badge ${accent}`}
        style={{
          background: 'transparent',
          padding: 0,
          fontSize: '1.15rem',
        }}
      >
        {value}
      </span>
    </div>
  );
}


interface EcosystemVisualProps {
  state: EcosystemState;
  config: (typeof stateConfig)[EcosystemState];
  buildingId: string;
}

function EcosystemVisual({ state, config, buildingId }: EcosystemVisualProps) {
  const leaves = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2;
    const radius = 38 + (i % 3) * 12;
    const x = 150 + Math.cos(angle) * radius;
    const y = 130 + Math.sin(angle) * radius * 0.7;
    const isVisible = i < config.leafCount;
    const colorIndex = i % 3;
    return { x, y, isVisible, color: config.leafColors[colorIndex], i };
  });

  const flowers = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + 0.5;
    const radius = 45 + (i % 2) * 15;
    return {
      x: 150 + Math.cos(angle) * radius,
      y: 120 + Math.sin(angle) * radius * 0.6,
      isVisible: i < config.flowerCount,
      i,
    };
  });

  const trunkDroop = state === 'critical' ? 8 : state === 'declining' ? 3 : 0;
  const description = `Living environment for building ${buildingId}. State: ${config.label}. ${config.leafCount} of 24 leaves visible, ${config.flowerCount} of 8 blooms.`;

  return (
    <div
      style={{
        position: 'relative',
        padding: 'var(--space-5)',
        background: `linear-gradient(180deg, ${config.bgFrom} 0%, ${config.bgTo} 100%)`,
        transition: 'background 1.2s ease',
      }}
    >
      <p className="sr-only">{description}</p>

      <div
        style={{
          position: 'absolute',
          top: 'var(--space-4)',
          left: 'var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 'var(--radius-pill)',
          background:
            'color-mix(in srgb, var(--brand-surface) 88%, transparent)',
          border: '1px solid var(--brand-border)',
          fontSize: 11,
          fontWeight: 'var(--fw-semibold)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--brand-ink-muted)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: config.grassColor,
            display: 'inline-block',
          }}
        />
        Tree of Life
      </div>

      <motion.svg
        viewBox="0 0 300 240"
        role="img"
        aria-label={description}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          maxHeight: 340,
        }}
        initial={false}
        transition={{ duration: 1.2 }}
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor={config.sunGlow} stopOpacity="1" />
            <stop offset="100%" stopColor={config.sunGlow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="trunkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.trunkHighlight} />
            <stop offset="100%" stopColor={config.trunkColor} />
          </linearGradient>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={config.grassHighlight}
              stopOpacity="0.55"
            />
            <stop
              offset="100%"
              stopColor={config.grassColor}
              stopOpacity="0.15"
            />
          </linearGradient>
        </defs>

        <motion.circle
          cx="250"
          cy="45"
          r="34"
          fill="url(#sunGlow)"
          initial={false}
          animate={{
            opacity:
              state === 'critical' ? 0.35 : state === 'declining' ? 0.65 : 1,
          }}
          transition={{ duration: 1 }}
        />
        <motion.circle
          cx="250"
          cy="45"
          r="13"
          initial={false}
          animate={{ fill: config.sunColor }}
          transition={{ duration: 1 }}
        />

        <ellipse cx="150" cy="212" rx="160" ry="32" fill="url(#groundGrad)" />
        <ellipse
          cx="150"
          cy="212"
          rx="26"
          ry="4"
          fill="var(--brand-ink)"
          opacity="0.08"
        />

        <motion.path
          d="M150 210 Q145 180 148 150 Q150 120 150 100"
          stroke="url(#trunkGrad)"
          strokeWidth={state === 'thriving' ? 12 : state === 'healthy' ? 11 : 8}
          strokeLinecap="round"
          fill="none"
          initial={false}
          animate={{ y: trunkDroop }}
          transition={{ duration: 1 }}
        />

        <motion.path
          d="M149 140 Q120 120 105 105"
          stroke={config.trunkColor}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          initial={false}
          animate={{
            opacity: state === 'critical' ? 0.35 : 1,
            y: trunkDroop,
          }}
          transition={{ duration: 1 }}
        />
        <motion.path
          d="M150 135 Q180 115 195 100"
          stroke={config.trunkColor}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          initial={false}
          animate={{
            opacity: state === 'critical' ? 0.35 : 1,
            y: trunkDroop,
          }}
          transition={{ duration: 1 }}
        />

        <AnimatePresence>
          {leaves.map((leaf) => (
            <motion.circle
              key={`leaf-${leaf.i}`}
              cx={leaf.x}
              cy={leaf.y}
              r={9}
              initial={false}
              animate={{
                opacity: leaf.isVisible ? 0.95 : 0,
                scale: leaf.isVisible ? 1 : 0.3,
                fill: leaf.isVisible ? leaf.color : 'var(--brand-secondary)',
                cx: leaf.x,
                cy: leaf.y,
              }}
              transition={{
                duration: 0.8,
                delay: leaf.isVisible ? leaf.i * 0.03 : 0,
                ease: 'easeOut',
              }}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {flowers.map((flower) => (
            <motion.g
              key={`flower-${flower.i}`}
              initial={false}
              animate={{
                opacity: flower.isVisible ? 1 : 0,
                scale: flower.isVisible ? 1 : 0,
              }}
              transition={{ duration: 0.6, delay: flower.i * 0.05 }}
              style={{ transformOrigin: `${flower.x}px ${flower.y}px` }}
            >
              <circle
                cx={flower.x}
                cy={flower.y}
                r="3.2"
                fill={config.flowerCenter}
              />
              <circle
                cx={flower.x - 3}
                cy={flower.y - 2}
                r="2.6"
                fill={config.flowerColor}
              />
              <circle
                cx={flower.x + 3}
                cy={flower.y - 2}
                r="2.6"
                fill={config.flowerColor}
              />
              <circle
                cx={flower.x}
                cy={flower.y + 3}
                r="2.6"
                fill={config.flowerColor}
              />
            </motion.g>
          ))}
        </AnimatePresence>

        {state === 'critical' &&
          [0, 1, 2].map((i) => (
            <motion.circle
              key={`falling-${i}`}
              cx={130 + i * 20}
              cy={160}
              r="4"
              fill={config.leafColors[0]}
              initial={{ opacity: 0, y: 0 }}
              animate={{
                opacity: [0, 0.75, 0],
                y: [0, 40, 60],
                x: [0, i % 2 === 0 ? 8 : -8, i % 2 === 0 ? 12 : -12],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.8,
                ease: 'easeIn',
              }}
            />
          ))}
      </motion.svg>
    </div>
  );
}