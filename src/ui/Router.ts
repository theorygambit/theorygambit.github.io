export type Route = { name: "home" } | { name: "game"; slug: string };

/**
 * Hash routing: #/ is home, #/g/<slug> is a game. It needs no server rewrites,
 * so GitHub Pages and a home screen launch always land on the same page.
 */
export class HashRouter {
  private snapshot: Route = HashRouter.parse();
  private readonly listeners = new Set<() => void>();

  constructor() {
    window.addEventListener("hashchange", () => {
      this.snapshot = HashRouter.parse();
      this.listeners.forEach((l) => l());
    });
  }

  static parse(): Route {
    const m = location.hash.match(/^#\/g\/([a-z0-9-]+)/);
    return m ? { name: "game", slug: m[1]! } : { name: "home" };
  }

  readonly subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  readonly getSnapshot = (): Route => this.snapshot;

  home(): void {
    location.hash = "#/";
  }

  game(slug: string): void {
    location.hash = `#/g/${slug}`;
  }

  static href(slug: string): string {
    return `#/g/${slug}`;
  }
}

export const router = new HashRouter();
