/*
  Icons are drawn on whole number grids so they stay sharp:
  a 24 unit viewBox at 24px for tools, and a 24 unit viewBox at 48px (exactly 2x) for game glyphs.
*/
export function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
    </svg>
  );
}

export function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

export function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4Z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  );
}

/** Game glyphs, keyed by slug. Each is a tiny mark in the same grammar as the games. */
export function GameGlyph({ slug }: { slug: string }) {
  switch (slug) {
    case "dominant-strategy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.25" y="3.25" width="17.5" height="17.5" />
          <path d="M12 3.25v17.5M3.25 12h17.5" />
          <circle className="solid" cx="7.6" cy="7.6" r="2.4" />
          <circle className="solid" cx="16.4" cy="7.6" r="1.4" />
          <circle className="solid" cx="7.6" cy="16.4" r="3.2" />
          <circle className="solid" cx="16.4" cy="16.4" r="2.2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
