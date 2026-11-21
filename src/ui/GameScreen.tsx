import { useCallback, useEffect, useRef, useState } from "react";
import { chapterOf } from "../catalog/chapters";
import { Curriculum } from "../catalog/curriculum";
import { Feedback } from "../core/Feedback";
import { GameRegistry } from "../core/Registry";
import { GameRuntime } from "../core/Runtime";
import { progress } from "../core/Store";
import { PathRouter, router } from "./Router";
import { TheorySheet, gambitUrl } from "./TheorySheet";

const LEVEL = { 1: "Intro level", 2: "Core level", 3: "Advanced level" } as const;

export function GameScreen({ slug }: { slug: string }) {
  const item = Curriculum.get(slug);
  const mod = GameRegistry.get(slug);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<GameRuntime | null>(null);
  const [sheet, setSheet] = useState(false);
  const [done, setDone] = useState(false);
  const [live, setLive] = useState("");
  const closeSheet = useCallback(() => setSheet(false), []);

  useEffect(() => {
    setDone(false);
    setSheet(false);
    if (!mod || !box.current || !canvas.current) return;
    progress.markOpened(slug);
    const rt = new GameRuntime(canvas.current, box.current, slug);
    runtime.current = rt;
    const offs = [
      rt.bus.on("announce", (m) => setLive(m)),
      rt.bus.on("beat", (b) => b === "feel" && setDone(false)),
      rt.bus.on("complete", () => {
        progress.markUnderstood(slug);
        setDone(true);
        Feedback.done();
      }),
    ];
    return () => {
      offs.forEach((o) => o());
      rt.dispose();
      runtime.current = null;
    };
  }, [slug, mod]);

  if (!item) return <EmptyScreen title="Not found" body="That game does not exist." />;
  if (!mod) {
    return (
      <>
        <EmptyScreen title={item.name} body={`This slot is empty for now. ${item.idea}`} link={gambitUrl(item)} parent={PathRouter.chapterHref(item.chapter)} />
      </>
    );
  }

  const next = Curriculum.next(slug, (s) => GameRegistry.has(s));

  return (
    <main className="screen game">
      <div className="game-col">
        <header className="game-head">
          <h1 className="game-title">{item.name}</h1>
          <p className="game-meta">
            {String(item.order).padStart(3, "0")} of {Curriculum.all().length},{" "}
            <a className="meta-link" href={PathRouter.chapterHref(item.chapter)}>
              {chapterOf(item.chapter).title}
            </a>
            , {LEVEL[item.level]}
          </p>
        </header>

        <div className="stage" ref={box}>
          <canvas ref={canvas} data-play role="img" aria-label={`${item.name} game`} />
        </div>
        <p className="sr" aria-live="polite">
          {live}
        </p>

        <nav className="dock" aria-label="Game controls">
          <button className="dock-btn" type="button" onClick={() => router.back(PathRouter.chapterHref(item.chapter))}>
            Menu
          </button>
          <button className="dock-btn" type="button" onClick={() => { runtime.current?.restart(); setDone(false); }}>
            Restart
          </button>
          <button className="dock-btn" type="button" onClick={() => setSheet(true)}>
            Theory
          </button>
          <button
            className={`dock-btn${done ? " is-lit" : ""}`}
            type="button"
            disabled={!next && !done}
            onClick={() => (next ? router.game(next.slug, true) : router.back(PathRouter.chapterHref(item.chapter)))}
          >
            {next || !done ? "Next" : "Menu"}
          </button>
        </nav>

        <TheorySheet open={sheet} onClose={closeSheet} item={item} theory={mod.theory} />
      </div>
    </main>
  );
}

function EmptyScreen({ title, body, link, parent = "/" }: { title: string; body: string; link?: string; parent?: string }) {
  return (
    <main className="screen game">
      <div className="game-col">
        <header className="game-head">
          <h1 className="game-title">{title}</h1>
          <p className="game-meta">{body}</p>
          {link && (
            <a className="sheet-link" href={link} target="_blank" rel="noreferrer">
              Read the entry in The Gambit
            </a>
          )}
        </header>
        <div style={{ flex: 1 }} />
        <nav className="dock" aria-label="Game controls" style={{ gridTemplateColumns: "1fr" }}>
          <button className="dock-btn" type="button" onClick={() => router.back(parent)}>
            Menu
          </button>
        </nav>
      </div>
    </main>
  );
}
