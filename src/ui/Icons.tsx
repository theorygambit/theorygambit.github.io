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
    case "prisoners-dilemma":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="8.5" cy="12" r="4.5" />
          <circle cx="15.5" cy="12" r="4.5" />
          <path d="M12 3.5v17" />
        </svg>
      );
    case "matching-pennies":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="solid" d="M12 4a8 8 0 0 0 0 16Z" />
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
    case "stag-hunt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="9" cy="10.5" r="4.5" />
          <circle cx="17.5" cy="14" r="3" />
          <path d="M3 20.5h18" />
        </svg>
      );
    case "ultimatum":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect className="solid" x="3" y="8" width="11" height="7" />
          <rect x="14.5" y="8.5" width="6.5" height="6" />
          <path d="M14 5v13" />
          <circle className="solid" cx="14" cy="20.5" r="1.5" />
        </svg>
      );
    case "information-types":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M3 12h18" />
          <circle className="solid" cx="12" cy="7.5" r="2.5" />
        </svg>
      );
    case "short-long-games":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="3" />
          <circle className="solid" cx="19" cy="12" r="4" />
        </svg>
      );
    case "iterated-elimination":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.25" y="3.25" width="17.5" height="17.5" />
          <rect x="7.25" y="7.25" width="9.5" height="9.5" />
          <circle className="solid" cx="12" cy="12" r="2.4" />
        </svg>
      );
    case "nash-equilibrium":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 18L21 6M3 6L21 18" />
          <circle className="solid" cx="12" cy="12" r="2.8" />
          <circle cx="12" cy="12" r="5.5" />
        </svg>
      );
    case "mixed-strategy":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path className="solid" d="M12 12V4A8 8 0 0 1 18.9 16Z" />
        </svg>
      );
    case "minimax-theorem":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 8Q12 22 21 8" />
          <path d="M12 3V21" />
          <circle className="solid" cx="12" cy="14.5" r="2.4" />
        </svg>
      );
    case "backward-induction":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 12H5M9 8l-4 4 4 4" />
          <circle className="solid" cx="20" cy="12" r="1.8" />
        </svg>
      );
    case "public-goods":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="12" cy="12" r="3" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      );
    case "centipede":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 12H21" />
          <circle className="solid" cx="5" cy="12" r="1.8" />
          <circle cx="10.5" cy="12" r="2.6" />
          <circle className="solid" cx="16" cy="12" r="3.4" />
        </svg>
      );
    case "travelers-dilemma":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 5H9V10H15V15H21" />
          <circle className="solid" cx="18" cy="19" r="2.2" />
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
