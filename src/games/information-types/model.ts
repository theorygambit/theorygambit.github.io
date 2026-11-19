import type { Rng } from "../../core/Rng";

export type Side = 0 | 1;

/** One round of the Feel game. The other player takes the side with the bigger payoff. */
export interface InfoRound {
  /** Perfect information: you see their move before you choose. */
  seen: boolean;
  /** Complete information: you know their payoffs. */
  known: boolean;
  /** Their payoffs for the left and right box. */
  pays: [number, number];
}

export const MATCH_PAYOFF = 3;

export function ringSide(r: InfoRound): Side {
  return r.pays[0] > r.pays[1] ? 0 : 1;
}

/** You win by matching their side. */
export function outcome(r: InfoRound, guess: Side): number {
  return guess === ringSide(r) ? MATCH_PAYOFF : 0;
}

/** Can a careful player be sure of the match? True when they see the move or can read the payoffs. */
export function decidable(r: InfoRound): boolean {
  return r.seen || r.known;
}

/** Which corner of the two question grid a round sits in. x: 0 perfect, 1 imperfect. y: 0 complete, 1 incomplete. */
export function quadrant(seen: boolean, known: boolean): { x: 0 | 1; y: 0 | 1 } {
  return { x: seen ? 0 : 1, y: known ? 0 : 1 };
}

/** Four rounds, one per corner, in shuffled order, with fresh payoffs each time. */
export function feelRounds(rng: Rng): InfoRound[] {
  const corners: [boolean, boolean][] = [[true, true], [false, true], [true, false], [false, false]];
  return rng.shuffle(corners).map(([seen, known]) => {
    const hi = rng.int(6, 9);
    const lo = rng.int(1, 4);
    const pays: [number, number] = rng.chance(0.5) ? [hi, lo] : [lo, hi];
    return { seen, known, pays };
  });
}

export interface Scene {
  name: string;
  seen: boolean;
  known: boolean;
}

export const SCENES: readonly Scene[] = [
  { name: "Chess.", seen: true, known: true },
  { name: "Tic tac toe.", seen: true, known: true },
  { name: "Rock paper scissors.", seen: false, known: true },
  { name: "Battleship.", seen: false, known: true },
  { name: "Sealed bids, private values.", seen: false, known: false },
  { name: "Bargaining with an unknown rival, in turns.", seen: true, known: false },
  { name: "Hiring, applicant skill hidden, offers in turns.", seen: true, known: false },
  { name: "A one shot dilemma, moves hidden.", seen: false, known: true },
];

/** Three scenes from three different corners, so one remembered label cannot pass. */
export function proveScenes(rng: Rng): Scene[] {
  const pool = rng.shuffle(SCENES);
  const out: Scene[] = [];
  for (const s of pool) {
    if (out.every((o) => o.seen !== s.seen || o.known !== s.known)) out.push(s);
    if (out.length === 3) break;
  }
  return out;
}
