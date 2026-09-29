import { useId } from "react";

interface OptiGridLogoProps {
  
  height?: number;
  
  markOnly?: boolean;
  
  className?: string;
  
  title?: string;
}

export function OptiGridLogo({
  height = 36,
  markOnly = false,
  className,
  title = "OptiGrid",
}: OptiGridLogoProps) {
  const uid = useId();
  const gradId = `og-grad-${uid.replace(/:/g, "")}`;

  const markSize = 96;
  const totalWidth = markOnly ? markSize : markSize + 230;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${markSize}`}
      width={markOnly ? height : height * (totalWidth / markSize)}
      height={height}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22E0D0" />
          <stop offset="55%" stopColor="#12B8F0" />
          <stop offset="100%" stopColor="#1E7BE8" />
        </linearGradient>
      </defs>

      
      <g>
    
        {[
          { x1: 20, y1: 20, x2: 48, y2: 4 },
          { x1: 48, y1: 4, x2: 76, y2: 20 },
          { x1: 76, y1: 20, x2: 76, y2: 52 },
          { x1: 76, y1: 52, x2: 48, y2: 68 },
          { x1: 48, y1: 68, x2: 20, y2: 52 },
          { x1: 20, y1: 52, x2: 20, y2: 20 },
        ].map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={`url(#${gradId})`}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}

                {[
          [48, 4],
          [76, 20],
          [76, 52],
          [48, 68],
          [20, 52],
          [20, 20],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="6" fill={`url(#${gradId})`} />
        ))}

        
        <path
          d="M 54 18
             L 32 52
             L 46 52
             L 40 78
             L 66 42
             L 51 42
             L 60 18
             Z"
          fill={`url(#${gradId})`}
          strokeLinejoin="round"
        />
      </g>

    
      {!markOnly && (
        <g transform="translate(112, 0)">
          <text
            x="0"
            y="62"
            fontFamily="var(--font-heading, 'Space Grotesk'), system-ui, sans-serif"
            fontWeight="800"
            fontSize="56"
            letterSpacing="-1.5"
            fill="currentColor"
          >
            OPTI
            <tspan fill={`url(#${gradId})`}>GRID</tspan>
          </text>
        </g>
      )}
    </svg>
  );
}