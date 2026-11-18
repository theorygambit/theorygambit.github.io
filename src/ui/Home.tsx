import { useSyncExternalStore } from "react";
import { chapterOf } from "../catalog/chapters";
import { Curriculum, TIER_INFO } from "../catalog/curriculum";
import type { Tier } from "../catalog/types";
import { GameRegistry } from "../core/Registry";
import { prefs, progress } from "../core/Store";
import { theme } from "../core/Theme";
import { GameGlyph, MoonIcon, SoundOffIcon, SoundOnIcon, SunIcon } from "./Icons";
import { Hero } from "./Hero";
import { PathRouter } from "./Router";

const TIERS: Tier[] = ["foundations", "core", "advanced", "synthesis"];

export function Home() {
  const pr = useSyncExternalStore(prefs.subscribe, prefs.getSnapshot);
  const pg = useSyncExternalStore(progress.subscribe, progress.getSnapshot);
  const dark = theme.effective() === "dark";
  const all = Curriculum.all();
  const playable = all.filter((i) => GameRegistry.has(i.slug));

  return (
    <main className="screen home">
      <div className="home-col">
        <div className="home-bar">
          <a className="link-btn" href="https://hassanireza.github.io/gambit" target="_blank" rel="noreferrer">
            The Gambit
          </a>
          <div className="bar-tools">
            <button className="tool-btn" type="button" aria-label={pr.sound ? "Mute sound" : "Turn sound on"} aria-pressed={pr.sound} onClick={() => prefs.setSound(!pr.sound)}>
              {pr.sound ? <SoundOnIcon /> : <SoundOffIcon />}
            </button>
            <button className="tool-btn" type="button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => theme.toggle()}>
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        <Hero />

        <div className="home-body">
          <h2 className="section-title">
            Play, {playable.length} of {all.length}
          </h2>
          <ol className="games">
            {playable.map((i) => (
              <li key={i.slug}>
                <a className="row" href={PathRouter.href(i.slug)}>
                  <span className="row-glyph">
                    <GameGlyph slug={i.slug} />
                  </span>
                  <span>
                    <span className="row-name">{i.name}</span>
                    <span className="row-hook" style={{ display: "block" }}>
                      {GameRegistry.get(i.slug)?.hook}
                    </span>
                  </span>
                  <span className={`row-state${pg.understood.includes(i.slug) ? " is-done" : ""}`} role="img" aria-label={pg.understood.includes(i.slug) ? "Understood" : "Not yet played"} />
                </a>
              </li>
            ))}
          </ol>

          <h2 className="section-title">Library</h2>
          {TIERS.map((t) => {
            const items = Curriculum.byTier(t);
            return (
              <details className="tier" key={t} open={t === "foundations"}>
                <summary>
                  {TIER_INFO[t].title}
                  <span className="tier-count">{items.length}</span>
                </summary>
                <p className="tier-blurb">{TIER_INFO[t].blurb}</p>
                <ol className="slots">
                  {items.map((i) => (
                    <li className="slot" key={i.slug} aria-label={`${i.name}, ${chapterOf(i.chapter).title}`}>
                      <span className="slot-n">{String(i.order).padStart(3, "0")}</span>
                      <a className="slot-name" style={GameRegistry.has(i.slug) ? { color: "var(--text)" } : undefined} href={PathRouter.href(i.slug)}>
                        {i.name}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            );
          })}

          <p className="foot">
            One game for every theory in{" "}
            <a href="https://hassanireza.github.io/gambit" target="_blank" rel="noreferrer">
              The Gambit
            </a>
            . New games arrive in the order shown above, easy to hard.
          </p>
        </div>
      </div>
    </main>
  );
}
