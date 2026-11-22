/** One arena you could enter: a prize, your chance of winning it and the cost of entering. */
export class Arena {
  readonly name: string;
  readonly prize: number;
  readonly win: number;
  readonly cost: number;

  constructor(name: string, prize: number, win: number, cost = 1) {
    this.name = name;
    this.prize = prize;
    this.win = win;
    this.cost = cost;
  }

  /** What entering is worth on average. */
  get ev(): number {
    return this.win * this.prize - this.cost;
  }
}

export function bestArena(set: readonly Arena[]): number {
  const top = Math.max(...set.map((a) => a.ev));
  return set.findIndex((a) => a.ev === top);
}

/** Four sets of three arenas. The best arena is never the biggest prize and never the best odds. */
export const FEEL_SETS: readonly (readonly Arena[])[] = [
  [new Arena("A", 16, 0.1), new Arena("B", 8, 0.3), new Arena("C", 3, 0.6)],
  [new Arena("A", 10, 0.3), new Arena("B", 24, 0.1), new Arena("C", 4, 0.5)],
  [new Arena("A", 5, 0.7), new Arena("B", 15, 0.2), new Arena("C", 10, 0.4)],
  [new Arena("A", 20, 0.1), new Arena("B", 8, 0.4), new Arena("C", 3, 0.8)],
];

/** New sets for Prove. The best arena moves and is never the biggest prize or the best odds. */
export const PROVE_SETS: readonly (readonly Arena[])[] = [
  [new Arena("A", 18, 0.1), new Arena("B", 9, 0.35), new Arena("C", 4, 0.5)],
  [new Arena("A", 4, 0.7), new Arena("B", 10, 0.35), new Arena("C", 20, 0.1)],
];
