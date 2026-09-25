'use client';

import { useId, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
  readonly buildingId: string;
}

export function LivingEnvironment({ buildingId }: LivingEnvironmentProps) {
  const seed = useMemo(() => {
    let h = 0;
    for (let i = 0; i < buildingId.length; i++) {
      h = (h * 31 + (buildingId.charCodeAt(i) ?? 0));
    }
    return Math.abs(h);
  }, [buildingId]);

  const [energyEfficiency, setEnergyEfficiency] = useState(60 + (seed % 40));
  const [renewables, setRenewables] = useState(55 + ((seed >> 3) % 45));
  const [hvacLoad, setHvacLoad] = useState(55 + ((seed >> 6) % 40));
  const [lighting, setLighting] = useState(60 + ((seed >> 9) % 40));

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
    <div className="esg-layout">
      <div className="esg-column">
        <section className="card esg-tree" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="dashboard-section-header"
            style={{
              padding: 'var(--space-5) var(--space-5) 0',
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
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
          </div>
        </section>

        <div className="esg-drivers">
          <WhatIsAffectingPanel
            drivers={drivers}
            healthScore={healthScore}
            state={state}
          />
        </div>
      </div>

      
      <section className="card esg-controls">
        <header
          className="dashboard-section-header"
          style={{ marginBottom: 'var(--space-4)' }}
        >
          <div>
            <h2 className="dashboard-section-title">Building Performance</h2>
            <p className="dashboard-section-meta">
              Move a slider, the tree responds instantly.
            </p>
          </div>
        </header>

        <div style={{ display: 'grid', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
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
            marginTop: 'auto',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--brand-border)',
          }}
        >
          Weightage - efficiency 35%  renewables 30%  HVAC 20%  
          lighting 15%.
        </div>
      </section>

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
  readonly drivers: Driver[];
  readonly healthScore: number;
  readonly state: EcosystemState;
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
          Score <span className="metric">{healthScore}</span>  tree is{' '}
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



function DriverBar({ driver, rank }: { readonly driver: Driver;readonly rank: number }) {
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




interface ControlSliderProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly accent: string;
}

function ControlSlider({ label, value, onChange, accent }: ControlSliderProps) {
  const id = useId();

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);


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

        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: `${value}%`,
            transform: `translate(-50%, -50%) scale(${hovered ? 1.15 : 1})`,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: 'var(--brand-surface)',
            border: `2px solid var(${accent})`,
            boxShadow: focused ? 'var(--focus-ring)' : 'var(--shadow-card)',
            pointerEvents: 'none',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        />


        <input
          id={id}
          type="range"
          className="esg-range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}

          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}

          style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            height: 20,
            appearance: 'none',
            background: 'transparent',
            cursor: 'pointer',
            margin: 0,
            opacity:1,
            outline:'none',
          }}
          
        />
      </div>
    </div>
  );
}


function TreeStat({
  label,
  value,
  accent,
}: {
  readonly label: string;
  readonly value: string;
  readonly accent: string;
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
  readonly state: EcosystemState;
  readonly config: (typeof stateConfig)[EcosystemState];
  readonly buildingId: string;
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

const trunkDroop = getTrunkDroop(state);

function getTrunkDroop(state: EcosystemState): number {
  if (state === 'critical') return 8;
  if (state === 'declining') return 3;
  return 0;
}


  function getTrunkWidth(state: EcosystemState): number {
  if (state === 'thriving') return 12;
  if (state === 'healthy') return 11;
  return 8;
}

function getSunOpacity(state: EcosystemState): number {
  if (state === 'critical') return 0.35;
  if (state === 'declining') return 0.65;
  return 1;
}

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
           opacity: getSunOpacity(state)
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
          

          strokeWidth={getTrunkWidth(state)}
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