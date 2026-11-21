import { chapterOf } from "../catalog/chapters";
import type { CatalogItem } from "../catalog/types";
import { GameRegistry } from "../core/Registry";
import { GameGlyph } from "./Icons";
import { PathRouter } from "./Router";

/** A playable game: glyph, name, one line, and whether you have understood it. */
export function GameRow({ item, done }: { item: CatalogItem; done: boolean }) {
  return (
    <li>
      <a className="row" href={PathRouter.href(item.slug)}>
        <span className="row-glyph">
          <GameGlyph slug={item.slug} />
        </span>
        <span>
          <span className="row-name">{item.name}</span>
          <span className="row-hook" style={{ display: "block" }}>
            {GameRegistry.get(item.slug)?.hook}
          </span>
        </span>
        <span className={`row-state${done ? " is-done" : ""}`} role="img" aria-label={done ? "Understood" : "Not yet played"} />
      </a>
    </li>
  );
}

/** A game that is planned but not built yet. */
export function SlotRow({ item, showChapter = false }: { item: CatalogItem; showChapter?: boolean }) {
  return (
    <li className="slot" aria-label={`${item.name}, not built yet`}>
      <span className="slot-n">{String(item.order).padStart(3, "0")}</span>
      <a className="slot-name" href={PathRouter.href(item.slug)}>
        {item.name}
        {showChapter && <span className="slot-chapter">{chapterOf(item.chapter).title}</span>}
      </a>
    </li>
  );
}
