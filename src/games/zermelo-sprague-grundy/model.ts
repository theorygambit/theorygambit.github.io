import type { Rng } from "../../core/Rng";

/** Nim: piles of tokens. A move takes any number from one pile. Whoever takes the last token wins. */
export const xor = (piles: readonly number[]): number => piles.reduce((a, b) => a ^ b, 0);

/** The piles after taking `take` from pile `pile`. */
export const after = (piles: readonly number[], pile: number, take: number): number[] => piles.map((p, i) => (i === pile ? p - take : p));

/** The player to move loses against perfect play exactly when the xor is zero. */
export const moverWins = (piles: readonly number[]): boolean => xor(piles) !== 0;

/** A move that leaves xor zero, or null when there is none. */
export function winningMove(piles: readonly number[]): [number, number] | null {
  const x = xor(piles);
  if (x === 0) return null;
  for (let i = 0; i < piles.length; i++) {
    const target = piles[i]! ^ x;
    if (target < piles[i]!) return [i, piles[i]! - target];
  }
  return null;
}

export const NAMES = ["first", "second", "third"];

export interface Round {
  piles: number[];
  a: [number, number];
  b: [number, number];
}
export const FEEL_ROUNDS: readonly Round[] = [
  { piles: [3, 4, 5], a: [0, 2], b: [1, 1] },
  { piles: [2, 3, 4], a: [1, 1], b: [2, 3] },
  { piles: [1, 3, 5], a: [2, 3], b: [1, 1] },
  { piles: [4, 5, 6], a: [0, 2], b: [1, 3] },
];
/** You win from here when the move leaves xor zero. */
export const holds = (r: Round, m: [number, number]): boolean => xor(after(r.piles, m[0], m[1])) === 0;

export const SEE_PILES = [3, 4, 5];

export const PROVE_POOL: readonly (readonly number[])[] = [[1, 4, 5], [2, 5, 7], [3, 5, 6], [2, 3, 6], [4, 6, 7], [1, 2, 4]];

/** One where the mover wins and one where they lose. */
export function proveSet(rng: Rng): number[][] {
  const w = PROVE_POOL.filter(moverWins);
  const l = PROVE_POOL.filter((p) => !moverWins(p));
  return rng.shuffle([[...rng.pick(w)], [...rng.pick(l)]]);
}
