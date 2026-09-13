import { useId } from "react";

const ROTORS = [
  { id: "rotor-fl", cx: 82, cy: 72, rx: 58, ry: 15 },
  { id: "rotor-fr", cx: 338, cy: 72, rx: 58, ry: 15 },
  { id: "rotor-rl", cx: 112, cy: 207, rx: 52, ry: 13 },
  { id: "rotor-rr", cx: 308, cy: 207, rx: 52, ry: 13 },
];

function Rotor({ id, cx, cy, rx, ry, fieldId }) {
  return (
    <g className={`drone-model__rotor ${id}`}>
      <ellipse
        className="drone-model__rotor-disc"
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        style={{ fill: `url(#${fieldId})` }}
      />
      <ellipse className="drone-model__rotor-guard" cx={cx} cy={cy} rx={rx - 3} ry={ry + 5} />
      <g
        className="drone-model__propeller"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <ellipse cx={cx} cy={cy} rx={rx - 5} ry="3.2" />
        <ellipse cx={cx} cy={cy} rx="3.2" ry={Math.max(ry + 3, 17)} />
      </g>
      <ellipse className="drone-model__motor" cx={cx} cy={cy} rx="11" ry="9" />
      <ellipse className="drone-model__motor-cap" cx={cx} cy={cy - 1} rx="5.5" ry="4" />
    </g>
  );
}

export default function DroneModel({ className = "drone-model" }) {
  const instanceId = useId().replace(/:/g, "");
  const armMetalId = `drone-arm-metal-${instanceId}`;
  const shellId = `drone-shell-${instanceId}`;
  const shellLowerId = `drone-shell-lower-${instanceId}`;
  const canopyId = `drone-canopy-${instanceId}`;
  const lensId = `drone-lens-${instanceId}`;
  const rotorFieldId = `drone-rotor-field-${instanceId}`;
  const shadowId = `drone-shadow-${instanceId}`;
  const glowId = `drone-glow-${instanceId}`;

  return (
    <svg className={className} viewBox="0 0 420 280">
      <defs>
        <linearGradient id={armMetalId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#07131e" />
          <stop offset="0.42" stopColor="#60788d" />
          <stop offset="0.7" stopColor="#182b3b" />
          <stop offset="1" stopColor="#06111a" />
        </linearGradient>
        <linearGradient id={shellId} x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0" stopColor="#f9fdff" />
          <stop offset="0.27" stopColor="#d8e6ef" />
          <stop offset="0.61" stopColor="#829aab" />
          <stop offset="0.82" stopColor="#40596b" />
          <stop offset="1" stopColor="#172a38" />
        </linearGradient>
        <linearGradient id={shellLowerId} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#688195" />
          <stop offset="1" stopColor="#172733" />
        </linearGradient>
        <linearGradient id={canopyId} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#8bf5ff" stopOpacity="0.94" />
          <stop offset="0.36" stopColor="#20c9e8" stopOpacity="0.72" />
          <stop offset="1" stopColor="#062336" stopOpacity="0.96" />
        </linearGradient>
        <radialGradient id={lensId}>
          <stop offset="0" stopColor="#d7fbff" />
          <stop offset="0.18" stopColor="#37e7ff" />
          <stop offset="0.45" stopColor="#067f9d" />
          <stop offset="0.68" stopColor="#03111d" />
          <stop offset="1" stopColor="#00060c" />
        </radialGradient>
        <radialGradient id={rotorFieldId}>
          <stop offset="0" stopColor="#73efff" stopOpacity="0.2" />
          <stop offset="0.62" stopColor="#21cbe8" stopOpacity="0.08" />
          <stop offset="1" stopColor="#21cbe8" stopOpacity="0" />
        </radialGradient>
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="200%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#000811" floodOpacity="0.72" />
        </filter>
        <filter id={glowId} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="drone-model__airframe" filter={`url(#${shadowId})`}>
        <g className="drone-model__arms" stroke={`url(#${armMetalId})`} strokeLinecap="round">
          <path d="M174 126 L84 75" />
          <path d="M246 126 L336 75" />
          <path d="M170 157 L113 204" />
          <path d="M250 157 L307 204" />
        </g>

        <g className="drone-model__arm-highlights" strokeLinecap="round">
          <path d="M175 122 L87 71" />
          <path d="M245 122 L333 71" />
          <path d="M171 153 L115 200" />
          <path d="M249 153 L305 200" />
        </g>

        {ROTORS.map((rotor) => <Rotor key={rotor.id} {...rotor} fieldId={rotorFieldId} />)}

        <path
          className="drone-model__lower-shell"
          d="M143 136 C148 108 166 91 194 87 H226 C254 91 272 108 277 136 L270 174 C264 194 245 205 226 208 H194 C175 205 156 194 150 174 Z"
          style={{ fill: `url(#${shellLowerId})` }}
        />
        <path
          className="drone-model__shell"
          d="M137 128 C141 101 164 78 193 75 H227 C256 78 279 101 283 128 L274 160 C269 178 250 188 229 190 H191 C170 188 151 178 146 160 Z"
          style={{ fill: `url(#${shellId})` }}
        />
        <path className="drone-model__shell-highlight" d="M157 117 C168 91 190 85 214 84 C241 83 259 94 269 119" />
        <path
          className="drone-model__canopy"
          d="M174 98 C185 86 235 86 246 98 L256 128 H164 Z"
          style={{ fill: `url(#${canopyId})` }}
        />
        <path className="drone-model__canopy-glint" d="M184 101 C199 93 220 92 235 98" />

        <g className="drone-model__intakes">
          <path d="M153 143 C163 139 173 138 181 141 L178 152 C168 154 160 152 153 148 Z" />
          <path d="M267 143 C257 139 247 138 239 141 L242 152 C252 154 260 152 267 148 Z" />
        </g>

        <g className="drone-model__battery">
          <rect x="189" y="139" width="42" height="10" rx="5" />
          <rect
            x="192"
            y="142"
            width="34"
            height="4"
            rx="2"
            style={{ filter: `url(#${glowId})` }}
          />
          <circle cx="232.5" cy="144" r="1.8" />
        </g>

        <g className="drone-model__gimbal">
          <path d="M193 181 L190 205 C196 213 224 213 230 205 L227 181" />
          <ellipse cx="210" cy="209" rx="24" ry="22" />
          <ellipse className="drone-model__lens-ring" cx="210" cy="209" rx="15" ry="14" />
          <ellipse
            className="drone-model__lens"
            cx="210"
            cy="209"
            rx="9"
            ry="9"
            style={{ fill: `url(#${lensId})`, filter: `url(#${glowId})` }}
          />
          <circle className="drone-model__lens-glint" cx="206.5" cy="205.5" r="2.2" />
        </g>

        <g className="drone-model__landing-gear" fill="none" strokeLinecap="round">
          <path d="M170 179 L158 221 L178 224" />
          <path d="M250 179 L262 221 L242 224" />
        </g>

        <circle
          className="drone-model__nav drone-model__nav--left"
          cx="151"
          cy="135"
          r="4"
          style={{ filter: `url(#${glowId})` }}
        />
        <circle
          className="drone-model__nav drone-model__nav--right"
          cx="269"
          cy="135"
          r="4"
          style={{ filter: `url(#${glowId})` }}
        />
      </g>
    </svg>
  );
}
