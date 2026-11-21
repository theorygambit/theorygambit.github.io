import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CHAPTERS } from "../catalog/chapters";
import { Curriculum } from "../catalog/curriculum";
import type { CatalogItem } from "../catalog/types";
import { GameRegistry } from "../core/Registry";
import { prefs, progress } from "../core/Store";
import { theme } from "../core/Theme";
import { GameRow, SlotRow } from "./GameRows";
import { Hero } from "./Hero";
import { GameGlyph, MoonIcon, SoundOffIcon, SoundOnIcon, SunIcon } from "./Icons";
import { PathRouter } from "./Router";
import { useScrollMemory } from "./useScrollMemory";

const romanLevel = { 1: "Intro", 2: "Core", 3: "Advanced" } as const;

export function Home() {
  const pr = useSyncExternalStore(prefs.subscribe, prefs.getSnapshot);
  const pg = useSyncExternalStore(progress.subscribe, progress.getSnapshot);
  const dark = theme.effective() === "dark";
  const scroller = useRef<HTMLElement>(null);
  useScrollMemory(scroller);
  const [query, setQuery] = useState("");

  const all = Curriculum.all();
  const playable: CatalogItem[] = useMemo(() => all.filter((i) => GameRegistry.has(i.slug)), [all]);
  const understood = playable.filter((i) => pg.understood.includes(i.slug));
  // The path is the curriculum order, easy to hard. Continue is the first playable game not yet understood.
  const next = playable.find((i) => !pg.understood.includes(i.slug)) ?? playable[0];
  const started = pg.opened.length > 0;

  const q = query.trim().toLowerCase();
  const found = useMemo(() => (q ? all.filter((i) => i.name.toLowerCase().includes(q) || i.idea.toLowerCase().includes(q)) : []), [q, all]);

  return (
    <main className="screen home" ref={scroller}>
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
          {next && !q && (
            <section aria-label={started ? "Continue" : "Start here"}>
              <h2 className="section-title">{started ? "Continue" : "Start here"}</h2>
              <a className="resume" href={PathRouter.href(next.slug)}>
                <span className="row-glyph">
                  <GameGlyph slug={next.slug} />
                </span>
                <span>
                  <span className="row-name">{next.name}</span>
                  <span className="row-hook" style={{ display: "block" }}>
                    {GameRegistry.get(next.slug)?.hook}
                  </span>
                  <span className="resume-meta">
                    {String(next.order).padStart(3, "0")} of {all.length}, {romanLevel[next.level]}
                  </span>
                </span>
                <span className="resume-go">Play</span>
              </a>
              <div className="progress" role="img" aria-label={`${understood.length} of ${playable.length} games understood`}>
                <span className="progress-bar" style={{ width: `${(understood.length / Math.max(1, playable.length)) * 100}%` }} />
              </div>
              <p className="progress-note">
                {understood.length} of {playable.length} games understood
              </p>
            </section>
          )}

          <div className="search">
            <label className="sr" htmlFor="q">
              Search all games
            </label>
            <input
              id="q"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={`Search all ${all.length} games`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {q ? (
            <section aria-label="Search results">
              <h2 className="section-title">
                {found.length} {found.length === 1 ? "result" : "results"}
              </h2>
              <ol className="games">
                {found.map((i) => (GameRegistry.has(i.slug) ? <GameRow key={i.slug} item={i} done={pg.understood.includes(i.slug)} /> : <SlotRow key={i.slug} item={i} showChapter />))}
              </ol>
              {found.length === 0 && <p className="empty-note">Nothing matches. Try a shorter word.</p>}
            </section>
          ) : (
            <section aria-label="Chapters">
              <h2 className="section-title">Chapters</h2>
              <ol className="chapters">
                {CHAPTERS.map((c) => {
                  const items = all.filter((i) => i.chapter === c.id);
                  const built = items.filter((i) => GameRegistry.has(i.slug));
                  const got = built.filter((i) => pg.understood.includes(i.slug)).length;
                  return (
                    <li key={c.id}>
                      <a className="chap" href={PathRouter.chapterHref(c.id)}>
                        <span className="chap-n">{c.numeral}</span>
                        <span>
                          <span className="chap-name">{c.title}</span>
                          <span className="chap-meta">
                            {built.length > 0 ? `${built.length} to play, ${got} understood` : "Coming"}, {items.length} in all
                          </span>
                          <span className="progress progress-thin" aria-hidden="true">
                            <span className="progress-bar" style={{ width: `${built.length ? (got / built.length) * 100 : 0}%` }} />
                          </span>
                        </span>
                        <span className="chap-go" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <p className="foot">
            One game for every theory in{" "}
            <a href="https://hassanireza.github.io/gambit" target="_blank" rel="noreferrer">
              The Gambit
            </a>
            . New games arrive in order, easy to hard.
          </p>
        </div>
      </div>
    </main>
  );
}
