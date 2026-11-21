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
    case "focal-points":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="3.5" cy="12" r="1.5" />
          <circle cx="7.5" cy="12" r="1.5" />
          <circle className="solid" cx="12.5" cy="12" r="3.2" />
          <circle cx="17.5" cy="12" r="1.5" />
          <circle cx="21" cy="12" r="1.5" />
        </svg>
      );
    case "chicken":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="9" cy="12" r="3.5" />
          <circle cx="15" cy="12" r="3.5" />
          <path d="M2 9.5h3.5M2 14.5h3.5M18.5 9.5H22M18.5 14.5H22" />
        </svg>
      );
    case "battle-of-sexes":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9.5" cy="12" r="6.5" />
          <circle cx="14.5" cy="12" r="6.5" />
          <path className="solid" d="M12 6A6.5 6.5 0 0 1 12 18A6.5 6.5 0 0 1 12 6Z" />
        </svg>
      );
    case "dictator":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="12" cy="7" r="4" />
          <path d="M12 12.5v3" />
          <circle cx="12" cy="19" r="2.5" />
        </svg>
      );
    case "trust-game":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="5" cy="12" r="2" />
          <path d="M8.5 12h3" />
          <circle cx="17" cy="12" r="5" />
        </svg>
      );
    case "tragedy-commons":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <circle className="solid" cx="12" cy="7.5" r="1.6" />
          <circle className="solid" cx="7.8" cy="14.5" r="1.6" />
          <circle className="solid" cx="16.2" cy="14.5" r="1.6" />
        </svg>
      );
    case "axelrod-tit-for-tat":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="4.5" cy="8.5" r="1.7" />
          <circle className="solid" cx="9.5" cy="8.5" r="1.7" />
          <circle className="solid" cx="14.5" cy="8.5" r="1.7" />
          <circle cx="9.5" cy="15.5" r="2" />
          <circle cx="14.5" cy="15.5" r="2" />
          <circle cx="19.5" cy="15.5" r="2" />
        </svg>
      );
    case "flow-theory":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 14L14 3M10 21L21 10" />
          <circle className="solid" cx="12" cy="12" r="2.2" />
        </svg>
      );
    case "design-ethics":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 20.5h18" />
          <path d="M3.5 18L20.5 5" />
          <path d="M3.5 18C8 6 14 6 20.5 18" />
        </svg>
      );
    case "expected-utility":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3.5 20.5Q6 6 20.5 4" />
          <path d="M3.5 20.5L20.5 4" />
          <circle className="solid" cx="12" cy="12.2" r="1.8" />
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
    case "volunteers-dilemma":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="12" cy="7.5" r="3.5" />
          <circle cx="5.5" cy="17" r="3" />
          <circle cx="12" cy="17" r="3" />
          <circle cx="18.5" cy="17" r="3" />
        </svg>
      );
    case "beauty-contest":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 17.5h18" />
          <circle cx="6" cy="12" r="2.2" />
          <circle cx="11" cy="12" r="2.2" />
          <circle cx="16" cy="12" r="2.2" />
          <circle className="solid" cx="13.5" cy="6" r="2.8" />
        </svg>
      );
    case "dollar-auction":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="9" r="5" strokeDasharray="2 2.5" />
          <circle className="solid" cx="7" cy="18" r="3" />
          <circle cx="17" cy="18" r="3.5" />
        </svg>
      );
    case "colonel-blotto":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="6" cy="16" r="3.5" />
          <circle className="solid" cx="12" cy="16" r="2" />
          <circle cx="18" cy="16" r="3.5" />
          <circle cx="12" cy="6" r="2.5" strokeDasharray="2 2" />
        </svg>
      );
    case "cournot":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="4" y1="20" x2="4" y2="4" />
          <line x1="4" y1="20" x2="20" y2="20" />
          <line x1="6" y1="5" x2="19" y2="18" />
          <line x1="6" y1="17" x2="19" y2="7" strokeDasharray="2 2.5" />
          <circle className="solid" cx="12.5" cy="12" r="2.3" />
        </svg>
      );
    case "bertrand":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="7.5" cy="9" r="3.2" />
          <circle cx="16.5" cy="9" r="3.2" />
          <path d="M3 20.5h18M12 14.5v6" />
        </svg>
      );
    case "stackelberg":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="7" cy="12" r="4.5" />
          <circle cx="18" cy="12" r="2.8" />
          <line x1="11.5" y1="12" x2="15" y2="12" strokeDasharray="1.5 2" />
        </svg>
      );
    case "hotelling":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="10" cy="8" r="3.2" />
          <circle cx="15" cy="8" r="3.2" />
          <path d="M3 18.5h18M3 16.5v4M21 16.5v4" />
        </svg>
      );
    case "repeated-games":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="5.5" cy="12" r="3.5" />
          <circle className="solid" cx="13" cy="12" r="2.5" />
          <circle cx="19" cy="12" r="1.8" />
          <path d="M3 20.5h18" />
        </svg>
      );
    case "dynamic-games":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle className="solid" cx="8.5" cy="12" r="3" />
          <circle cx="15.5" cy="12" r="2.2" />
        </svg>
      );
    case "evolutionary-game-theory":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="7" cy="12" r="3.5" />
          <circle cx="17" cy="12" r="3.5" />
          <path d="M3 20h18" />
        </svg>
      );
    case "lemons-adverse-selection":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4v16M4 12h16" />
          <circle className="solid" cx="8" cy="8" r="2" />
        </svg>
      );
    case "auctions":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h16" />
          <path d="M6 20V10h5v10M13 20V5h5v15" />
          <circle className="solid" cx="8.5" cy="6.5" r="1.8" />
        </svg>
      );
    case "matching":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="6" cy="6" r="2.6" />
          <circle className="solid" cx="6" cy="18" r="2.6" />
          <circle cx="18" cy="6" r="2.6" />
          <circle cx="18" cy="18" r="2.6" />
          <path d="M8.6 6L15.4 6M8.6 18L15.4 18" />
        </svg>
      );
    case "cooperative-games":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="12" cy="7" r="3" />
          <circle cx="6.5" cy="17" r="3" />
          <circle cx="17.5" cy="17" r="3" />
        </svg>
      );
    case "prospect-theory":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21L12 12L21 3" />
          <path d="M12 12L3 3" />
          <circle className="solid" cx="12" cy="12" r="2.2" />
        </svg>
      );
    case "allais-paradox":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.25" y="3.25" width="7.5" height="7.5" />
          <rect x="13.25" y="3.25" width="7.5" height="7.5" />
          <circle className="solid" cx="7" cy="17" r="3" />
          <circle cx="17" cy="17" r="3" />
        </svg>
      );
    case "loss-aversion-streaks":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="4.5" cy="12" r="1.8" />
          <circle className="solid" cx="9.5" cy="12" r="2.4" />
          <circle className="solid" cx="15.5" cy="12" r="3.1" />
          <path d="M20 8v8" />
        </svg>
      );
    case "preference-manipulation":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="6" cy="17" r="2.6" />
          <circle cx="17" cy="7" r="2.6" />
          <circle className="solid" cx="18" cy="15" r="2.2" />
          <path d="M3 21h18M3 3v18" />
        </svg>
      );
    case "behavioral-game-theory":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "elo-trueskill":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 17H21" />
          <circle className="solid" cx="9" cy="17" r="3" />
          <circle cx="17" cy="17" r="2.4" />
          <path d="M3 5C8 5 8 11 12 11S16 5 21 5" />
        </svg>
      );
    case "dynamic-difficulty":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21V3" />
          <path d="M3 18L8 8L12 14L16 10L21 11" />
          <circle className="solid" cx="8" cy="8" r="2" />
          <circle cx="16" cy="10" r="2" />
        </svg>
      );
    case "ltv-prediction":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="5" cy="12" r="3.2" />
          <circle className="solid" cx="12" cy="12" r="2.2" />
          <circle className="solid" cx="18" cy="12" r="1.4" />
          <path d="M3 20H21" />
        </svg>
      );
    case "rules-engines":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="4.5" />
          <rect x="3" y="10" width="18" height="4.5" />
          <rect x="3" y="16" width="18" height="4.5" />
          <circle className="solid" cx="6" cy="6.2" r="1.3" />
        </svg>
      );
    case "engagement-stack":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="15" width="16" height="4" />
          <rect x="6" y="9.5" width="12" height="4" />
          <rect className="solid" x="8" y="4" width="8" height="4" />
        </svg>
      );
    case "correlated-equilibrium":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="9" y="3" width="6" height="18" />
          <circle className="solid" cx="12" cy="8" r="2" />
          <circle cx="12" cy="16" r="2" />
        </svg>
      );
    case "subgame-perfect":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h6l8-6M10 12l8 6" />
          <circle className="solid" cx="5" cy="12" r="2" />
          <circle cx="10" cy="12" r="2" />
        </svg>
      );
    case "trembling-hand":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12c2-3 3 3 5 0s3 3 5 0 3 3 5 0" />
          <circle className="solid" cx="12" cy="18" r="2" />
        </svg>
      );
    case "sequential-equilibrium":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 4v7M12 11l-6 8M12 11l6 8" />
          <circle cx="12" cy="4" r="2" />
          <circle className="solid" cx="12" cy="11" r="2" />
        </svg>
      );
    case "perfect-bayesian":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="solid" cx="6" cy="8" r="2" />
          <circle className="solid" cx="12" cy="8" r="2" />
          <circle className="solid" cx="18" cy="8" r="2" />
          <circle cx="12" cy="16" r="2" />
          <circle cx="18" cy="16" r="2" />
          <path d="M3 12h18" />
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
