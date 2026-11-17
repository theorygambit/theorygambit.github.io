/** Small seeded generator (mulberry32). Seeds make every game replayable and testable. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  static hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  static fresh(): Rng {
    const buf = new Uint32Array(1);
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) crypto.getRandomValues(buf);
    else buf[0] = (Math.random() * 4294967296) >>> 0;
    return new Rng(buf[0]!);
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Inclusive integer range. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** Independent stream derived from this one, so subsystems never disturb each other. */
  fork(label: string): Rng {
    return new Rng(Math.floor(this.next() * 4294967296) ^ Rng.hash(label));
  }
}
