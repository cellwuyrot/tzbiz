export function LivingSystem() {
  return (
    <div className="relative aspect-[1.04] w-full overflow-hidden" role="img" aria-label="Схема цифровой системы TRIOZ">
      <svg className="h-full w-full" viewBox="0 0 720 640" fill="none" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="lineInk" x1="80" y1="90" x2="620" y2="560" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-text)" stopOpacity="0.05" />
            <stop offset="0.45" stopColor="var(--color-text)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--color-text)" stopOpacity="0.04" />
          </linearGradient>
          <radialGradient id="aura" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(475 188) rotate(132) scale(300)">
            <stop stopColor="var(--color-accent)" stopOpacity="0.25" />
            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="482" cy="184" r="250" fill="url(#aura)" />

        <g opacity="0.11" stroke="var(--color-text)" strokeWidth="1">
          <path d="M36 118H684M36 178H684M36 238H684M36 298H684M36 358H684M36 418H684M36 478H684M36 538H684" />
          <path d="M96 58V590M156 58V590M216 58V590M276 58V590M336 58V590M396 58V590M456 58V590M516 58V590M576 58V590M636 58V590" />
        </g>

        <g stroke="url(#lineInk)" strokeWidth="1.25">
          <path d="M90 184H214L278 122H442L504 186H636" />
          <path d="M92 430H190L262 354H372L436 420H620" />
          <path d="M172 546L240 478H354L430 308H560" />
          <path d="M274 72V122M442 122V292M504 186V418M372 354V540" />
        </g>

        <g className="system-node system-node--one">
          <circle cx="214" cy="184" r="7" fill="var(--color-text)" />
          <circle cx="214" cy="184" r="18" stroke="var(--color-accent)" strokeOpacity="0.45" />
        </g>
        <g className="system-node system-node--two">
          <circle cx="442" cy="122" r="6" fill="var(--color-accent)" />
          <circle cx="442" cy="122" r="16" stroke="var(--color-accent)" strokeOpacity="0.35" />
        </g>
        <g className="system-node system-node--three">
          <circle cx="504" cy="186" r="5" fill="var(--color-text)" />
          <circle cx="504" cy="186" r="15" stroke="var(--color-accent)" strokeOpacity="0.3" />
        </g>
        <g className="system-node system-node--four">
          <circle cx="372" cy="354" r="8" fill="var(--color-accent)" />
          <circle cx="372" cy="354" r="20" stroke="var(--color-accent)" strokeOpacity="0.38" />
        </g>

        <g className="data-particle data-particle--a">
          <circle cx="126" cy="184" r="3.5" fill="var(--color-accent)" />
        </g>
        <g className="data-particle data-particle--b">
          <circle cx="318" cy="122" r="3" fill="var(--color-text)" />
        </g>
        <g className="data-particle data-particle--c">
          <circle cx="545" cy="420" r="3.5" fill="var(--color-accent)" />
        </g>

        <g transform="translate(86 102)">
          <path d="M0 0h106l28 26v44H0z" fill="var(--color-panel)" stroke="var(--color-text)" strokeOpacity="0.12" />
          <path d="M20 25h52M20 38h74M20 51h48" stroke="var(--color-text)" strokeOpacity="0.18" strokeLinecap="round" />
          <circle cx="94" cy="24" r="5" fill="var(--color-accent)" />
        </g>

        <g transform="translate(448 384)">
          <path d="M0 0h122l34 30v74H0z" fill="var(--color-panel)" stroke="var(--color-text)" strokeOpacity="0.12" />
          <path d="M22 30l24-16 22 20 28-32 34 28" stroke="var(--color-text)" strokeOpacity="0.24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 84h84" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        </g>
      </svg>

      <div className="absolute bottom-2 left-0 right-0 flex items-end justify-between gap-4 sm:bottom-6 sm:left-6 sm:right-6">
        <div>
          <p className="eyebrow">TRIOZ / SYSTEM VIEW</p>
          <p className="mt-2 max-w-sm type-h3">Связываем процессы, людей и технологии в работающую систему.</p>
        </div>
        <span className="hidden type-ui text-subtle sm:block">LIVE / FLOW</span>
      </div>
    </div>
  );
}
