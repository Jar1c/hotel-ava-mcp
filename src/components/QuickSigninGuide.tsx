/**
 * "How it works" guide for Quick Sign-In: three illustrated cards shown
 * simultaneously — each with its own inline SVG micro-animation looping on
 * independent CSS keyframes (.qs-* in index.css). No stepping/clicking needed;
 * prefers-reduced-motion users get static frames (all content still visible).
 */

const STEPS = [
  {
    title: "Open Quick Sign-In",
    desc: "On the other device's Login page, choose Quick Sign-In.",
  },
  {
    title: "Scan or type the code",
    desc: "Point the camera at its QR code, or enter the code above.",
  },
  {
    title: "Device signs in",
    desc: "A scan approves instantly — or type the code and use the button.",
  },
]

const CHARS = ["A", "B", "C", "D", "2", "3", "4", "5"]

/* ── Scene 1: open Quick Sign-In on the other device ─────────────────────── */
function SceneOpen() {
  return (
    <svg viewBox="0 0 360 190" className="h-full w-full" aria-hidden="true">
      {/* soft glow behind the button */}
      <circle cx="180" cy="84" r="56" fill="var(--color-primary)" opacity="0.06" />

      {/* phone */}
      <rect x="112" y="8" width="136" height="174" rx="20" fill="#FFFFFF" stroke="#D5DADF" />
      <rect x="120" y="20" width="120" height="150" rx="12" fill="#F1F3F5" />
      <rect x="164" y="13" width="32" height="4" rx="2" fill="#E6E9EE" />

      {/* brand */}
      <text
        x="180"
        y="48"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="var(--color-primary)"
        className="font-body"
      >
        Hotel Ava
      </text>
      <rect x="150" y="56" width="60" height="5" rx="2.5" fill="#E2E5EA" />

      {/* Quick Sign-In button — pressed by the animated cursor */}
      <g className="qs-anim qs-press">
        <rect
          x="130"
          y="72"
          width="100"
          height="24"
          rx="8"
          fill="var(--color-primary)"
          fillOpacity="0.12"
          stroke="var(--color-primary)"
          strokeOpacity="0.6"
        />
        <rect x="140" y="78" width="12" height="12" rx="2" fill="none" stroke="var(--color-primary)" strokeWidth="1.6" />
        <rect x="143.5" y="81.5" width="5" height="5" fill="var(--color-primary)" />
        <rect x="158" y="81" width="58" height="6" rx="3" fill="var(--color-primary)" fillOpacity="0.8" />
      </g>

      {/* secondary button hint */}
      <rect x="130" y="104" width="100" height="16" rx="6" fill="#FFFFFF" stroke="#E6E9EE" />
      <rect x="152" y="109" width="56" height="5" rx="2.5" fill="#E2E5EA" />

      {/* the code panel pops out after the click */}
      <g className="qs-anim qs-popin">
        <rect x="266" y="64" width="52" height="52" rx="12" fill="#FFFFFF" stroke="#D5DADF" />
        <rect x="274" y="72" width="13" height="13" rx="1" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <rect x="277.5" y="75.5" width="6" height="6" fill="var(--color-primary)" />
        <rect x="297" y="72" width="13" height="13" rx="1" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <rect x="300.5" y="75.5" width="6" height="6" fill="var(--color-primary)" />
        <rect x="274" y="95" width="13" height="13" rx="1" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <rect x="277.5" y="98.5" width="6" height="6" fill="var(--color-primary)" />
        <rect x="297" y="97" width="5" height="5" fill="var(--color-ink)" fillOpacity="0.7" />
        <rect x="304" y="96" width="5" height="5" fill="var(--color-ink)" fillOpacity="0.7" />
        <rect x="297" y="104" width="5" height="5" fill="var(--color-ink)" fillOpacity="0.7" />
      </g>

      {/* cursor */}
      <g className="qs-anim qs-cursor" transform="translate(200 84)">
        <path
          d="M0 0 L0 16 L4.5 12 L7 17 L10 15.5 L7.5 10.7 L13 10.5 Z"
          fill="var(--color-ink)"
          stroke="#FFFFFF"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/* ── Scene 2: scan the QR or type the code ───────────────────────────────── */
function SceneScan() {
  return (
    <svg viewBox="0 0 360 190" className="h-full w-full" aria-hidden="true">
      {/* phone with QR */}
      <rect x="26" y="18" width="100" height="154" rx="16" fill="#FFFFFF" stroke="#D5DADF" />
      <rect x="34" y="30" width="84" height="130" rx="10" fill="#F1F3F5" />
      <rect x="66" y="23" width="20" height="3" rx="1.5" fill="#E6E9EE" />

      <rect x="46" y="48" width="60" height="60" rx="6" fill="#FFFFFF" stroke="#E6E9EE" />
      {/* viewfinder corners */}
      <path d="M46 60 V54 a6 6 0 0 1 6 -6 H58" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
      <path d="M94 48 H100 a6 6 0 0 1 6 6 V60" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
      <path d="M106 96 V102 a6 6 0 0 1 -6 6 H94" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
      <path d="M58 108 H52 a6 6 0 0 1 -6 -6 V96" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
      {/* QR modules */}
      <rect x="53" y="55" width="13" height="13" fill="none" stroke="#2A2A28" strokeWidth="2.5" />
      <rect x="56.5" y="58.5" width="6" height="6" fill="#2A2A28" />
      <rect x="86" y="55" width="13" height="13" fill="none" stroke="#2A2A28" strokeWidth="2.5" />
      <rect x="89.5" y="58.5" width="6" height="6" fill="#2A2A28" />
      <rect x="53" y="88" width="13" height="13" fill="none" stroke="#2A2A28" strokeWidth="2.5" />
      <rect x="56.5" y="91.5" width="6" height="6" fill="#2A2A28" />
      <rect x="74" y="56" width="6" height="6" fill="#2A2A28" />
      <rect x="82" y="66" width="6" height="6" fill="#2A2A28" />
      <rect x="72" y="74" width="6" height="6" fill="#2A2A28" />
      <rect x="86" y="76" width="6" height="6" fill="#2A2A28" />
      <rect x="94" y="88" width="6" height="6" fill="#2A2A28" />
      <rect x="78" y="92" width="6" height="6" fill="#2A2A28" />
      {/* sweeping scan beam */}
      <rect
        x="46"
        y="49"
        width="60"
        height="4"
        rx="2"
        fill="var(--color-primary)"
        className="qs-beam"
      />

      <rect x="46" y="120" width="60" height="5" rx="2.5" fill="#E2E5EA" />
      <rect x="46" y="131" width="40" height="5" rx="2.5" fill="#E6E9EE" />
      <rect
        x="46"
        y="143"
        width="60"
        height="11"
        rx="5.5"
        fill="var(--color-primary)"
        fillOpacity="0.15"
        stroke="var(--color-primary)"
        strokeOpacity="0.4"
      />

      {/* code cells typing in */}
      <rect x="150" y="44" width="64" height="5" rx="2.5" fill="#E2E5EA" />
      {CHARS.map((ch, i) => (
        <g key={ch + i} className="qs-anim qs-type" style={{ animationDelay: `${0.4 + i * 0.18}s` }}>
          <rect
            x={150 + i * 26}
            y="58"
            width="20"
            height="26"
            rx="5"
            fill="#FFFFFF"
            stroke="var(--color-primary)"
            strokeOpacity="0.5"
          />
          <text
            x={160 + i * 26}
            y="75"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="var(--color-ink)"
            className="font-body"
          >
            {ch}
          </text>
        </g>
      ))}

      {/* approve button fades in once the code is complete */}
      <g className="qs-fade" style={{ animationDelay: "2.5s" }}>
        <rect x="150" y="98" width="202" height="24" rx="8" fill="var(--color-primary)" fillOpacity="0.9" />
        <rect x="230" y="107" width="42" height="6" rx="3" fill="#FFFFFF" fillOpacity="0.9" />
      </g>
      <rect x="150" y="134" width="130" height="5" rx="2.5" fill="#E6E9EE" />
      <rect x="150" y="145" width="96" height="5" rx="2.5" fill="#E6E9EE" />
    </svg>
  )
}

/* ── Scene 3: the other device is signed in ──────────────────────────────── */
function SceneSigned() {
  const confetti = [
    { cx: 104, cy: 44, r: 4.5, fill: "var(--color-primary)", delay: 0.55 },
    { cx: 258, cy: 42, r: 4, fill: "var(--color-secondary)", delay: 0.7 },
    { cx: 94, cy: 92, r: 3.5, fill: "var(--color-primary)", fillOpacity: 0.6, delay: 0.85 },
    { cx: 270, cy: 88, r: 4.5, fill: "var(--color-secondary)", fillOpacity: 0.7, delay: 1 },
    { cx: 112, cy: 142, r: 4, fill: "var(--color-primary)", fillOpacity: 0.5, delay: 1.15 },
    { cx: 262, cy: 136, r: 3.5, fill: "var(--color-secondary)", fillOpacity: 0.6, delay: 1.3 },
  ]
  return (
    <svg viewBox="0 0 360 190" className="h-full w-full" aria-hidden="true">
      {/* phone */}
      <rect x="125" y="14" width="110" height="162" rx="16" fill="#FFFFFF" stroke="#D5DADF" />
      <rect x="133" y="26" width="94" height="138" rx="10" fill="#F1F3F5" />
      <rect x="169" y="19" width="22" height="3" rx="1.5" fill="#E6E9EE" />

      {/* signed-in user */}
      <circle cx="180" cy="72" r="24" fill="var(--color-primary)" fillOpacity="0.12" />
      <circle cx="180" cy="65" r="8" fill="var(--color-primary)" fillOpacity="0.85" />
      <path
        d="M166 92 a14 13 0 0 1 28 0 Z"
        fill="var(--color-primary)"
        fillOpacity="0.85"
      />
      <rect x="150" y="108" width="60" height="6" rx="3" fill="#E2E5EA" />
      <rect x="162" y="120" width="36" height="5" rx="2.5" fill="#E6E9EE" />

      {/* welcome pill with check */}
      <g className="qs-anim qs-popin">
        <rect
          x="146"
          y="134"
          width="68"
          height="18"
          rx="9"
          fill="var(--color-secondary)"
          fillOpacity="0.14"
          stroke="var(--color-secondary)"
          strokeOpacity="0.45"
        />
        <path
          d="M157 143 l4 4 l8 -9"
          fill="none"
          stroke="var(--color-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="174" y="140" width="30" height="5" rx="2.5" fill="var(--color-secondary)" fillOpacity="0.7" />
      </g>

      {/* success badge */}
      <circle cx="236" cy="150" r="20" fill="none" stroke="var(--color-secondary)" strokeWidth="3" className="qs-anim qs-ring" />
      <circle cx="236" cy="150" r="20" fill="var(--color-secondary)" className="qs-anim qs-badge" />
      <path
        d="M227 151 l5 5 l11 -12"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="qs-draw"
      />

      {/* confetti */}
      {confetti.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r={c.r}
          fill={c.fill}
          fillOpacity={(c as { fillOpacity?: number }).fillOpacity ?? 1}
          className="qs-confetti"
          style={{ animationDelay: `${c.delay}s` }}
        />
      ))}
    </svg>
  )
}

const SCENES = [SceneOpen, SceneScan, SceneSigned]

export default function QuickSigninGuide() {
  return (
    <div className="mt-7 border-t border-hairline-soft pt-5">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-soft">
        How it works
      </p>

      {/* three illustrated cards — all steps visible at once */}
      <ol className="mx-auto mt-4 grid max-w-[960px] gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => {
          const Scene = SCENES[i]
          return (
            <li
              key={s.title}
              className="relative rounded-[12px] border border-hairline-soft bg-canvas p-4 dark:bg-surface"
            >
              <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[11px] font-bold text-primary">
                {i + 1}
              </span>
              <div className="mt-4 h-[150px] w-full">
                <Scene />
              </div>
              <p className="mt-3 text-sm">
                <span className="font-bold text-primary">{i + 1}</span>{" "}
                <span className="font-semibold text-ink">{s.title}</span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{s.desc}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
