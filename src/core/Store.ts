/**
 * Tiny observable store with a stable snapshot, shaped for React's
 * useSyncExternalStore. Subclasses persist to localStorage when a key is given.
 */
export abstract class Store<T extends object> {
  private snapshot: T;
  private readonly listeners = new Set<() => void>();
  private readonly key: string | null;

  protected constructor(initial: T, key: string | null) {
    this.key = key;
    this.snapshot = initial;
    if (key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) this.snapshot = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
      } catch {
        // Storage can be blocked or corrupt. Defaults are fine.
      }
    }
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): T => this.snapshot;

  protected update(patch: Partial<T>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    if (this.key) {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.snapshot));
      } catch {
        // Private mode or full storage: keep working in memory.
      }
    }
    this.listeners.forEach((l) => l());
  }
}

export interface PrefsState {
  theme: "dark" | "light" | null;
  sound: boolean;
  haptics: boolean;
}

export class PrefsStore extends Store<PrefsState> {
  constructor() {
    super({ theme: null, sound: true, haptics: true }, "tg.prefs.v1");
  }
  setTheme(theme: "dark" | "light"): void {
    this.update({ theme });
  }
  setSound(sound: boolean): void {
    this.update({ sound });
  }
  setHaptics(haptics: boolean): void {
    this.update({ haptics });
  }
}

export interface ProgressState {
  /** Slugs whose Prove step was passed. */
  understood: string[];
  /** Slugs the player has opened at least once. */
  opened: string[];
}

export class ProgressStore extends Store<ProgressState> {
  constructor() {
    super({ understood: [], opened: [] }, "tg.progress.v1");
  }
  isUnderstood(slug: string): boolean {
    return this.getSnapshot().understood.includes(slug);
  }
  markOpened(slug: string): void {
    const s = this.getSnapshot();
    if (!s.opened.includes(slug)) this.update({ opened: [...s.opened, slug] });
  }
  markUnderstood(slug: string): void {
    const s = this.getSnapshot();
    if (!s.understood.includes(slug)) this.update({ understood: [...s.understood, slug] });
  }
  reset(): void {
    this.update({ understood: [], opened: [] });
  }
}

export const prefs = new PrefsStore();
export const progress = new ProgressStore();
