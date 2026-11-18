export type Route = { name: "home" } | { name: "game"; slug: string };

/**
 * Clean path routing: / is home and /g/<slug> is a game, with no hash in the URL.
 *
 * GitHub Pages has no server rewrites, so deep links rely on public/404.html (the build
 * copies index.html to it). Pages serves it for any unknown path and the app then reads
 * location.pathname. Older links of the form /#/g/<slug> are upgraded in place.
 */
export class PathRouter {
  private snapshot: Route;
  private readonly listeners = new Set<() => void>();

  constructor() {
    const legacy = location.hash.match(/^#\/g\/([a-z0-9-]+)/);
    if (legacy) history.replaceState(null, "", `/g/${legacy[1]}${location.search}`);
    else if (location.hash === "#/" || location.hash === "#") history.replaceState(null, "", `/${location.search}`);
    this.snapshot = PathRouter.parse();
    window.addEventListener("popstate", () => this.sync());
    // Plain same-origin links navigate without a reload.
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target || a.origin !== location.origin || a.hasAttribute("download")) return;
      if (!/^\/(g\/[a-z0-9-]+)?\/?$/.test(a.pathname)) return;
      e.preventDefault();
      this.go(a.pathname + a.search);
    });
  }

  static parse(): Route {
    const m = location.pathname.match(/^\/g\/([a-z0-9-]+)\/?$/);
    return m ? { name: "game", slug: m[1]! } : { name: "home" };
  }

  private sync(): void {
    this.snapshot = PathRouter.parse();
    this.listeners.forEach((l) => l());
  }

  private go(url: string): void {
    if (url === location.pathname + location.search) return;
    history.pushState(null, "", url);
    window.scrollTo?.(0, 0);
    this.sync();
  }

  readonly subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  readonly getSnapshot = (): Route => this.snapshot;

  home(): void {
    this.go(`/${location.search}`);
  }

  game(slug: string): void {
    this.go(`${PathRouter.href(slug)}${location.search}`);
  }

  static href(slug: string): string {
    return `/g/${slug}`;
  }
}

export const router = new PathRouter();
