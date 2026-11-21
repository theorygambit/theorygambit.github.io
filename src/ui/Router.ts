import { CHAPTERS } from "../catalog/chapters";

export type Route = { name: "home" } | { name: "chapter"; id: string } | { name: "game"; slug: string };

const CHAPTER_IDS = new Set<string>(CHAPTERS.map((c) => c.id));

/**
 * Clean path routing, three levels deep like the content itself:
 *
 *   /              home: hero, where to continue, the ten chapters, search
 *   /c/<chapter>   one chapter: its games, playable first
 *   /g/<slug>      a game
 *
 * GitHub Pages has no server rewrites, so deep links rely on public/404.html (the build
 * copies index.html to it). Pages serves it for any unknown path and the app then reads
 * location.pathname. Older links of the form /#/g/<slug> are upgraded in place.
 *
 * Going back. Every in-app navigation records its depth in history.state. `back()` uses the
 * browser's own history when the previous screen is ours, so the list you came from returns
 * exactly as you left it, scroll position included. When the game was opened by a link
 * (depth 0) there is nothing to go back to, so it climbs to the game's chapter instead.
 */
export class PathRouter {
  private snapshot: Route;
  private readonly listeners = new Set<() => void>();
  private readonly scrolls = new Map<string, number>();

  constructor() {
    const legacy = location.hash.match(/^#\/g\/([a-z0-9-]+)/);
    if (legacy) history.replaceState({ i: 0 }, "", `/g/${legacy[1]}${location.search}`);
    else if (location.hash === "#/" || location.hash === "#") history.replaceState({ i: 0 }, "", `/${location.search}`);
    else if (history.state?.i === undefined) history.replaceState({ i: 0 }, "");
    // We restore scroll ourselves, per screen. The browser's guess is wrong for a fixed-body app.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    this.snapshot = PathRouter.parse();
    window.addEventListener("popstate", () => this.sync());
    // Plain same-origin links navigate without a reload.
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.origin !== location.origin || a.hasAttribute("download")) return;
      if (!/^\/((g|c)\/[a-z0-9-]+)?\/?$/.test(a.pathname)) return;
      e.preventDefault();
      this.go(a.pathname + a.search);
    });
  }

  static parse(): Route {
    const g = location.pathname.match(/^\/g\/([a-z0-9-]+)\/?$/);
    if (g) return { name: "game", slug: g[1]! };
    const c = location.pathname.match(/^\/c\/([a-z0-9-]+)\/?$/);
    if (c && CHAPTER_IDS.has(c[1]!)) return { name: "chapter", id: c[1]! };
    return { name: "home" };
  }

  private sync(): void {
    this.snapshot = PathRouter.parse();
    this.listeners.forEach((l) => l());
  }

  private depth(): number {
    return (history.state as { i?: number } | null)?.i ?? 0;
  }

  private go(url: string, replace = false, keepScroll = false): void {
    if (url === location.pathname + location.search) return;
    const path = url.split("?")[0]!;
    if (replace) history.replaceState({ i: this.depth() }, "", url);
    else {
      // arriving fresh at a screen starts at its top; only going back restores a position
      if (!keepScroll) this.scrolls.delete(path);
      history.pushState({ i: this.depth() + 1 }, "", url);
    }
    this.sync();
  }

  readonly subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  readonly getSnapshot = (): Route => this.snapshot;

  /** Always lands on Home. `keepScroll` returns to where the list was left, as Menu-style buttons should. */
  home(keepScroll = false): void {
    this.go(`/${location.search}`, false, keepScroll);
  }

  chapter(id: string): void {
    this.go(`${PathRouter.chapterHref(id)}${location.search}`);
  }

  /** `replace` swaps the current entry instead of adding one, so Next never stacks games. */
  game(slug: string, replace = false): void {
    this.go(`${PathRouter.href(slug)}${location.search}`, replace);
  }

  /** Back to the screen we came from, or up to `parent` when there is none. */
  back(parent: string): void {
    if (this.depth() > 0) history.back();
    else this.go(`${parent}${location.search}`, true);
  }

  static href(slug: string): string {
    return `/g/${slug}`;
  }

  static chapterHref(id: string): string {
    return `/c/${id}`;
  }

  remember(path: string, y: number): void {
    this.scrolls.set(path, y);
  }

  recall(path: string): number {
    return this.scrolls.get(path) ?? 0;
  }
}

export const router = new PathRouter();
