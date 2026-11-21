import type { Rng } from "../../core/Rng";

/** The same game can be written as a tree (order matters) or a table (both choose at once). */
export interface TreeGame {
  first: [string, string];
  second: [string, string];
  /** pay[i][j] = [first mover, second mover] after first chose i and second chose j. */
  pay: [number, number][][];
}

const NAMES: { first: [string, string]; second: [string, string] }[] = [
  { first: ["Enter", "Stay out"], second: ["Fight", "Accept"] },
  { first: ["Offer", "Hold"], second: ["Buy", "Pass"] },
  { first: ["Build", "Wait"], second: ["Copy", "Ignore"] },
  { first: ["Invite", "Skip"], second: ["Come", "Decline"] },
];

export function randomTree(rng: Rng, nameIndex = rng.int(0, NAMES.length - 1)): TreeGame {
  const n = NAMES[nameIndex % NAMES.length]!;
  const pay: [number, number][][] = [];
  for (let i = 0; i < 2; i++) {
    // The second mover's payoffs differ within a row, so their best reply is never a tie.
    const b0 = rng.int(1, 9);
    let b1 = rng.int(1, 9);
    while (b1 === b0) b1 = rng.int(1, 9);
    pay.push([[rng.int(1, 9), b0], [rng.int(1, 9), b1]]);
  }
  return { first: [...n.first], second: [...n.second], pay };
}

/** The second mover's best reply to the first mover's choice. */
export function bestReply(g: TreeGame, i: number): 0 | 1 {
  return g.pay[i]![0]![1] >= g.pay[i]![1]![1] ? 0 : 1;
}

/** Where play ends in the tree: the first mover moves, the second mover replies. */
export function outcome(g: TreeGame, i: number): { i: number; j: 0 | 1; pay: [number, number] } {
  const j = bestReply(g, i);
  return { i, j, pay: g.pay[i]![j]! };
}

/** Table column for a leaf. A swapped table lists the second mover's options in the other order. */
export const columnOf = (j: number, swapped: boolean): number => (swapped ? 1 - j : j);

export interface MapPuzzle {
  game: TreeGame;
  i: 0 | 1;
  j: 0 | 1;
  swapped: boolean;
}

export function mapPuzzles(rng: Rng): MapPuzzle[] {
  const order = rng.shuffle([0, 1, 2, 3]);
  return [0, 1, 2].map((k) => ({
    game: randomTree(rng, order[k]!),
    i: rng.int(0, 1) as 0 | 1,
    j: rng.int(0, 1) as 0 | 1,
    swapped: rng.chance(0.5),
  }));
}
