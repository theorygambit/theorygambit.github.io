import { useEffect, useRef } from "react";
import { chapterOf } from "../catalog/chapters";
import type { CatalogItem } from "../catalog/types";
import type { TheoryEntry } from "../theory/types";

const LEVEL = { 1: "Intro level", 2: "Core level", 3: "Advanced level" } as const;
export const gambitUrl = (item: CatalogItem): string => (item.kind === "topic" ? `https://hassanireza.github.io/gambit/${item.slug}` : "https://hassanireza.github.io/gambit");

interface Props {
  open: boolean;
  onClose: () => void;
  item: CatalogItem;
  theory?: TheoryEntry;
}

/** The theory window. It opens by growing its height, so its text is never in a transformed layer. */
export function TheorySheet({ open, onClose, item, theory }: Props) {
  const close = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => close.current?.focus(), 60);
    if (body.current) body.current.scrollTop = 0;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", key);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <div className={`sheet${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-hidden={!open} aria-label={`${item.name}, theory`}>
      <div className="sheet-scrim" onClick={onClose} />
      <section className="sheet-panel">
        <header className="sheet-head">
          <div>
            <h2 className="sheet-title">{item.name}</h2>
            <p className="sheet-kicker">
              {chapterOf(item.chapter).title}, {LEVEL[item.level]}
            </p>
          </div>
          <button className="sheet-close" type="button" ref={close} onClick={onClose}>
            Close
          </button>
        </header>
        <div className="sheet-body" ref={body}>
          <p className="sheet-idea">{theory?.idea ?? item.idea}</p>
          {theory && (
            <>
              <h3>How this game teaches it</h3>
              <ol className="sheet-steps">
                {theory.taught.map((s) => (
                  <li key={s.beat}>
                    <b>{s.beat}</b>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
              <h3>The math</h3>
              <ul className="sheet-math">
                {theory.math.map((m) => (
                  <li key={m.label}>
                    <span>{m.label}</span>
                    <code>{m.expr}</code>
                  </li>
                ))}
              </ul>
              <h3>In practice</h3>
              <p>{theory.practice}</p>
              <p className="sheet-remember">{theory.remember}</p>
              <h3>Origin</h3>
              <p>{theory.origin}</p>
            </>
          )}
          <a className="sheet-link" href={gambitUrl(item)} target="_blank" rel="noreferrer">
            Read the full entry in The Gambit
          </a>
        </div>
      </section>
    </div>
  );
}
