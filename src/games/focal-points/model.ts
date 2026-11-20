import type { Rng } from "../../core/Rng";

/** One option in a row. Its look is all a stranger has to go on. */
export interface Mark {
  ring: boolean;
  big: boolean;
}

const key = (m: Mark): string => `${m.ring ? "r" : "d"}${m.big ? "b" : "s"}`;

/**
 * A row of options and the crowd that must pick one without talking.
 * An option that looks unlike the rest stands out, so more people pick it.
 * Salience is one over the square of how many options look the same, plus a
 * very small pull toward the first in reading order.
 */
export class Spread {
  readonly marks: readonly Mark[];

  constructor(marks: readonly Mark[]) {
    this.marks = marks;
  }

  get size(): number {
    return this.marks.length;
  }

  count(i: number): number {
    const k = key(this.marks[i]!);
    return this.marks.filter((m) => key(m) === k).length;
  }

  salience(i: number): number {
    return 1 / (this.count(i) * this.count(i)) + (i === 0 ? 0.012 : 0);
  }

  /** The share of a crowd that picks each option. */
  shares(): number[] {
    const w = this.marks.map((_, i) => this.salience(i));
    const t = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / t);
  }

  /** Chance that two strangers, each following the crowd, pick the same option. */
  matchChance(): number {
    return this.shares().reduce((a, s) => a + s * s, 0);
  }

  /** The option most strangers pick, or null when no option clearly leads. */
  focal(): number | null {
    const s = this.shares();
    const order = s.map((v, i) => [v, i] as const).sort((a, b) => b[0] - a[0]);
    return order[0]![0] >= 0.45 && order[0]![0] > order[1]![0] * 1.6 ? order[0]![1] : null;
  }

  pick(rng: Rng): number {
    const s = this.shares();
    let x = rng.next();
    for (let i = 0; i < s.length; i++) {
      x -= s[i]!;
      if (x <= 0) return i;
    }
    return s.length - 1;
  }
}

const plain: Mark = { ring: false, big: false };

function withOdd(n: number, at: number, base: Mark, odd: Mark): Spread {
  return new Spread(Array.from({ length: n }, (_, i) => (i === at ? odd : base)));
}

/** Four rounds: nothing stands out, one thing does, two things do, one big thing does. */
export function feelRounds(rng: Rng): Spread[] {
  const at = () => rng.int(1, 4);
  const a = at();
  let b = at();
  while (b === a) b = at();
  const two = new Spread(Array.from({ length: 5 }, (_, i) => (i === a || i === b ? { ring: true, big: false } : plain)));
  return [new Spread(Array.from({ length: 5 }, () => plain)), withOdd(5, at(), plain, { ring: true, big: false }), two, withOdd(5, at(), plain, { ring: false, big: true })];
}

export interface Puzzle {
  spread: Spread;
  answer: number;
}

/** Three new rows. The answer moves around and the rule is the only thing that carries over. */
export function proveSet(rng: Rng): Puzzle[] {
  const flip = rng.chance(0.5);
  const base: Mark = { ring: flip, big: false };
  const odd1: Mark = { ring: !flip, big: false };
  const at1 = rng.int(0, 4);
  const p1 = { spread: withOdd(5, at1, base, odd1), answer: at1 };

  const at2 = rng.int(0, 5);
  const p2 = { spread: withOdd(6, at2, { ring: !flip, big: false }, { ring: !flip, big: true }), answer: at2 };

  // A trap: three plain, two rings, one big. The single big one is the most unusual.
  const order = rng.shuffle([0, 1, 2, 3, 4, 5]);
  const marks: Mark[] = Array.from({ length: 6 }, () => plain);
  const kinds: Mark[] = [{ ring: false, big: false }, { ring: false, big: false }, { ring: false, big: false }, { ring: true, big: false }, { ring: true, big: false }, { ring: false, big: true }];
  order.forEach((slot, k) => (marks[slot] = kinds[k]!));
  const p3 = { spread: new Spread(marks), answer: order[5]! };
  return [p1, p2, p3];
}
