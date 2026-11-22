import type { Rng } from "../../core/Rng";

/**
 * A game tree of depth three over eight leaves. You (max) choose the left or right branch, then the rival (min)
 * chooses, then you choose a leaf. Leaves are your payoffs.
 */
export class Tree {
  readonly leaves: readonly number[];

  constructor(leaves: readonly number[]) {
    this.leaves = leaves;
  }

  /** The four nodes where you choose between two leaves. */
  get maxNodes(): number[] {
    return [0, 1, 2, 3].map((j) => Math.max(this.leaves[2 * j]!, this.leaves[2 * j + 1]!));
  }

  /** The two nodes where the rival chooses between two of your nodes. */
  get minNodes(): number[] {
    const m = this.maxNodes;
    return [Math.min(m[0]!, m[1]!), Math.min(m[2]!, m[3]!)];
  }

  get value(): number {
    const m = this.minNodes;
    return Math.max(m[0]!, m[1]!);
  }

  /** The branch to take at the root. */
  get bestBranch(): 0 | 1 {
    const m = this.minNodes;
    return m[1]! > m[0]! ? 1 : 0;
  }

  /** Alpha-beta, left to right: which leaves have to be read. */
  alphaBeta(): { value: number; visited: boolean[] } {
    const visited = this.leaves.map(() => false);
    let alpha = -Infinity;
    const beta0 = Infinity;
    let rootBest = -Infinity;
    for (let mi = 0; mi < 2; mi++) {
      let beta = beta0;
      let minV = Infinity;
      for (let xi = 0; xi < 2; xi++) {
        const j = mi * 2 + xi;
        let maxV = -Infinity;
        for (let li = 0; li < 2; li++) {
          const idx = 2 * j + li;
          visited[idx] = true;
          maxV = Math.max(maxV, this.leaves[idx]!);
          if (maxV >= beta) break;
        }
        minV = Math.min(minV, maxV);
        beta = Math.min(beta, minV);
        if (minV <= alpha) break;
      }
      rootBest = Math.max(rootBest, minV);
      alpha = Math.max(alpha, rootBest);
    }
    return { value: rootBest, visited };
  }

  /** Leaves alpha-beta never reads. */
  get skipped(): number[] {
    return this.alphaBeta().visited.flatMap((v, i) => (v ? [] : [i]));
  }
}

function random(rng: Rng): Tree {
  return new Tree(Array.from({ length: 8 }, () => rng.int(1, 9)));
}

/** Two trees to play in Feel. The best branch is not the one with the biggest leaf. */
export function feelTrees(rng: Rng): Tree[] {
  const out: Tree[] = [];
  while (out.length < 2) {
    const t = random(rng);
    const big = t.leaves.indexOf(Math.max(...t.leaves));
    if (Math.floor(big / 4) !== t.bestBranch && new Set(t.leaves).size >= 6) out.push(t);
  }
  return out;
}

/** Two trees for Prove with one to four leaves that alpha-beta never reads. */
export function proveTrees(rng: Rng): Tree[] {
  const out: Tree[] = [];
  while (out.length < 2) {
    const t = random(rng);
    const n = t.skipped.length;
    const ab = t.alphaBeta().value;
    if (n >= 1 && n <= 4 && ab === t.value && new Set(t.leaves).size >= 6 && (out.length === 0 || out[0]!.skipped.join() !== t.skipped.join())) out.push(t);
  }
  return out;
}
