/**
 * Decorative "mochi" mascot — a chubby pig-ish character rendered in pure SVG,
 * sitting on a yellow circle. Used on the dashboard hero card.
 */
export function HeroMascot() {
  return (
    <div className="relative size-48 shrink-0" aria-hidden>
      {/* Yellow circle */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 60% 40%, #FFE08A 0%, #FFD86B 100%)",
        }}
      />
      {/* Mascot body */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body */}
        <ellipse cx="100" cy="120" rx="62" ry="46" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="3" />
        {/* Belly highlight */}
        <ellipse cx="92" cy="128" rx="42" ry="28" fill="#FFF7EE" />
        {/* Ears */}
        <ellipse cx="64" cy="92" rx="10" ry="8" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="2.5" />
        <ellipse cx="136" cy="92" rx="10" ry="8" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="2.5" />
        {/* Cheeks (blush) */}
        <circle cx="70" cy="124" r="9" fill="#FFB199" opacity="0.7" />
        <circle cx="130" cy="124" r="9" fill="#FFB199" opacity="0.7" />
        {/* Eyes */}
        <circle cx="84" cy="116" r="3" fill="#1F1A14" />
        <circle cx="116" cy="116" r="3" fill="#1F1A14" />
        {/* Nose / mouth */}
        <path d="M96 132 Q100 136 104 132" stroke="#1F1A14" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Feet */}
        <ellipse cx="84" cy="164" rx="8" ry="4" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="2.5" />
        <ellipse cx="116" cy="164" rx="8" ry="4" fill="#FFFFFF" stroke="#1F1A14" strokeWidth="2.5" />
      </svg>
    </div>
  );
}
