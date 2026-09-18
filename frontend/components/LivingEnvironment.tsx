'use client';

import { useMemo, useState } from 'react';
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
    color: string;
    bgFrom: string;
    bgTo: string;
    trunkColor: string;
    leafColors: [string, string, string];
    leafCount: number;
    flowerCount: number;
    grassColor: string;
  }
> = {
  thriving: {
    label: 'Thriving',
    color: 'text-emerald-600',
    bgFrom: '#ecfdf5',
    bgTo: '#d1fae5',
    trunkColor: '#78350f',
    leafColors: ['#10b981', '#34d399', '#6ee7b7'],
    leafCount: 24,
    flowerCount: 8,
    grassColor: '#22c55e',
  },
  healthy: {
    label: 'Healthy',
    color: 'text-green-600',
    bgFrom: '#f0fdf4',
    bgTo: '#dcfce7',
    trunkColor: '#854d0e',
    leafColors: ['#22c55e', '#4ade80', '#86efac'],
    leafCount: 18,
    flowerCount: 4,
    grassColor: '#4ade80',
  },
  declining: {
    label: 'Declining',
    color: 'text-amber-600',
    bgFrom: '#fffbeb',
    bgTo: '#fef3c7',
    trunkColor: '#92400e',
    leafColors: ['#d97706', '#f59e0b', '#fbbf24'],
    leafCount: 10,
    flowerCount: 1,
    grassColor: '#a3a300',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-600',
    bgFrom: '#fef2f2',
    bgTo: '#fee2e2',
    trunkColor: '#78350f',
    leafColors: ['#b45309', '#92400e', '#78716c'],
    leafCount: 4,
    flowerCount: 0,
    grassColor: '#a16207',
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
  const [energyEfficiency, setEnergyEfficiency] = useState(85);
  const [renewables, setRenewables] = useState(70);
  const [hvacLoad, setHvacLoad] = useState(60);
  const [lighting, setLighting] = useState(80);

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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      
      <div className="lg:col-span-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-lg shadow-emerald-100/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Living Environment
            </h2>
            <span
              className={`rounded-full border border-current/30 bg-white/70 px-3 py-1 text-xs font-medium backdrop-blur-sm dark:bg-slate-900/70 ${config.color}`}
            >
              {config.label}
            </span>
          </div>

          <div className="relative">
            <EcosystemVisual state={state} config={config} />

            <div className="absolute bottom-4 left-4 rounded-xl bg-white/80 px-4 py-2 backdrop-blur-sm dark:bg-slate-900/80">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Health Score
              </p>
              <p className={`text-2xl font-bold tabular-nums ${config.color}`}>
                {healthScore}
              </p>
            </div>
          </div>
        </div>
      </div>

      
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-lg shadow-emerald-100/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Building Performance
          </h2>
          <p className="mb-5 text-xs text-slate-500 dark:text-slate-400">
            Adjust the controls and watch the tree respond.
          </p>

          <div className="space-y-6">
            <ControlSlider
              label="Energy Efficiency"
              value={energyEfficiency}
              onChange={setEnergyEfficiency}
              accent="emerald"
            />
            <ControlSlider
              label="Renewable Energy"
              value={renewables}
              onChange={setRenewables}
              accent="sky"
            />
            <ControlSlider
              label="HVAC Optimization"
              value={hvacLoad}
              onChange={setHvacLoad}
              accent="amber"
            />
            <ControlSlider
              label="Lighting Optimization"
              value={lighting}
              onChange={setLighting}
              accent="violet"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


interface ControlSliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  accent: 'emerald' | 'sky' | 'amber' | 'violet';
}

const accentClasses: Record<
  ControlSliderProps['accent'],
  { thumbBorder: string; badge: string; fill: string }
> = {
  emerald: {
    thumbBorder: 'border-emerald-500',
    badge:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    fill: 'from-emerald-400 to-emerald-500',
  },
  sky: {
    thumbBorder: 'border-sky-500',
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    fill: 'from-sky-400 to-sky-500',
  },
  amber: {
    thumbBorder: 'border-amber-500',
    badge:
      'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    fill: 'from-amber-400 to-amber-500',
  },
  violet: {
    thumbBorder: 'border-violet-500',
    badge:
      'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    fill: 'from-violet-400 to-violet-500',
  },
};

function ControlSlider({
  label,
  value,
  onChange,
  accent,
}: ControlSliderProps) {
  const colors = accentClasses[accent];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </label>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${colors.badge}`}
        >
          {value}%
        </span>
      </div>

      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div
          className={`absolute h-1.5 rounded-full bg-gradient-to-r ${colors.fill}`}
          style={{ width: `${value}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110
            ${colors.thumbBorder}
            [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md
            [&::-moz-range-thumb]:transition-transform
            [&::-moz-range-thumb]:hover:scale-110
            [&::-moz-range-thumb]:border-current
          `}
          style={{ color: 'transparent' }}
          aria-label={label}
        />
      </div>
    </div>
  );
}


interface EcosystemVisualProps {
  state: EcosystemState;
  config: (typeof stateConfig)[EcosystemState];
}

function EcosystemVisual({ state, config }: EcosystemVisualProps) {
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

  return (
    <div className="relative h-80 w-full overflow-hidden">
      <motion.svg
        viewBox="0 0 300 240"
        className="h-full w-full"
        initial={false}
        animate={{ backgroundColor: config.bgFrom }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        style={{ backgroundColor: config.bgFrom }}
      >
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <motion.rect
          width="300"
          height="240"
          initial={false}
          animate={{ fill: config.bgTo, opacity: 0.4 }}
          transition={{ duration: 1.2 }}
        />

        <motion.circle
          cx="250"
          cy="45"
          r="30"
          fill="url(#sunGlow)"
          initial={false}
          animate={{
            opacity:
              state === 'critical' ? 0.3 : state === 'declining' ? 0.6 : 1,
            r: state === 'thriving' ? 32 : 28,
          }}
          transition={{ duration: 1 }}
        />
        <motion.circle
          cx="250"
          cy="45"
          r="12"
          initial={false}
          animate={{
            fill:
              state === 'critical'
                ? '#a8a29e'
                : state === 'declining'
                  ? '#fbbf24'
                  : '#facc15',
          }}
          transition={{ duration: 1 }}
        />

        <motion.ellipse
          cx="150"
          cy="215"
          rx="160"
          ry="30"
          initial={false}
          animate={{ fill: config.grassColor }}
          transition={{ duration: 1 }}
          opacity={0.35}
        />

        <motion.path
          d="M150 210 Q145 180 148 150 Q150 120 150 100"
          stroke={config.trunkColor}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          initial={false}
          animate={{
            stroke: config.trunkColor,
            strokeWidth:
              state === 'thriving' ? 11 : state === 'healthy' ? 10 : 8,
            y: trunkDroop,
          }}
          transition={{ duration: 1 }}
        />

        <motion.path
          d="M149 140 Q120 120 105 105"
          stroke={config.trunkColor}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          initial={false}
          animate={{ opacity: state === 'critical' ? 0.3 : 1, y: trunkDroop }}
          transition={{ duration: 1 }}
        />
        <motion.path
          d="M150 135 Q180 115 195 100"
          stroke={config.trunkColor}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          initial={false}
          animate={{ opacity: state === 'critical' ? 0.3 : 1, y: trunkDroop }}
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
                opacity: leaf.isVisible ? 0.9 : 0,
                scale: leaf.isVisible ? 1 : 0.3,
                fill: leaf.isVisible ? leaf.color : '#a8a29e',
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
              <circle cx={flower.x} cy={flower.y} r="3" fill="#f472b6" />
              <circle cx={flower.x - 3} cy={flower.y - 2} r="2.5" fill="#fb7185" />
              <circle cx={flower.x + 3} cy={flower.y - 2} r="2.5" fill="#fb7185" />
              <circle cx={flower.x} cy={flower.y + 3} r="2.5" fill="#fb7185" />
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
              fill="#a16207"
              initial={{ opacity: 0, y: 0 }}
              animate={{
                opacity: [0, 0.7, 0],
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