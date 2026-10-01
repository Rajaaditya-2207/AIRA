/**
 * AIRA brand mark — the Airwave A glyph, inline SVG.
 * Used in the navbar (with wordmark) and anywhere the brand appears.
 */
export function AiraMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="AIRA logo">
      <defs>
        <linearGradient id="aira-mark-bars" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="112" fill="#14161D" />
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="112"
        fill="none"
        stroke="#262A35"
        strokeWidth="6"
      />
      <g fill="url(#aira-mark-bars)">
        <rect x="150" y="300" width="52" height="130" rx="26" />
        <rect x="230" y="120" width="52" height="310" rx="26" />
        <rect x="310" y="220" width="52" height="210" rx="26" />
      </g>
      <circle cx="256" cy="86" r="12" fill="#22D3EE" />
    </svg>
  );
}
