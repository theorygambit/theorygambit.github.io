import { useRef, useSyncExternalStore } from "react";
import { CHAPTERS } from "../catalog/chapters";
import { Curriculum } from "../catalog/curriculum";
import { GameRegistry } from "../core/Registry";
import { progress } from "../core/Store";
import { GameRow, SlotRow } from "./GameRows";
import { PathRouter, router } from "./Router";
import { useScrollMemory } from "./useScrollMemory";

export function ChapterScreen({ id }: { id: string }) {
  const pg = useSyncExternalStore(progress.subscribe, progress.getSnapshot);
  const scroller = useRef<HTMLElement>(null);
  useScrollMemory(scroller);
  const at = CHAPTERS.findIndex((c) => c.id === id);
  const chapter = CHAPTERS[at]!;
  const items = Curriculum.all().filter((i) => i.chapter === id);
  const built = items.filter((i) => GameRegistry.has(i.slug));
  const planned = items.filter((i) => !GameRegistry.has(i.slug));
  const got = built.filter((i) => pg.understood.includes(i.slug)).length;
  const prev = CHAPTERS[at - 1];
  const next = CHAPTERS[at + 1];

  return (
    <main className="screen chapter" ref={scroller}>
      <div className="home-col">
        <div className="top-bar">
          <button className="link-btn" type="button" onClick={() => router.home(true)}>
            Chapters
          </button>
          <span className="top-bar-n">
            {chapter.numeral} of {CHAPTERS.length}
          </span>
        </div>

        <header className="chapter-head">
          <h1 className="game-title">{chapter.title}</h1>
          <p className="game-meta">
            {built.length > 0 ? `${built.length} to play, ${got} understood, ${items.length} in all` : `${items.length} planned, none built yet`}
          </p>
          <div className="progress progress-thin" aria-hidden="true">
            <span className="progress-bar" style={{ width: `${built.length ? (got / built.length) * 100 : 0}%` }} />
          </div>
        </header>

        <div className="home-body">
          {built.length > 0 && (
            <>
              <h2 className="section-title">Play</h2>
              <ol className="games">
                {built.map((i) => (
                  <GameRow key={i.slug} item={i} done={pg.understood.includes(i.slug)} />
                ))}
              </ol>
            </>
          )}
          {planned.length > 0 && (
            <>
              <h2 className="section-title">{built.length > 0 ? "Coming next" : "Planned"}</h2>
              <ol className="slots">
                {planned.map((i) => (
                  <SlotRow key={i.slug} item={i} />
                ))}
              </ol>
            </>
          )}
        </div>

        <nav className="chapter-nav" aria-label="Other chapters">
          {prev ? (
            <a className="dock-btn" href={PathRouter.chapterHref(prev.id)}>
              {prev.numeral}. {prev.title}
            </a>
          ) : (
            <span className="dock-btn is-off" />
          )}
          {next ? (
            <a className="dock-btn" href={PathRouter.chapterHref(next.id)}>
              {next.numeral}. {next.title}
            </a>
          ) : (
            <span className="dock-btn is-off" />
          )}
        </nav>
      </div>
    </main>
  );
}
