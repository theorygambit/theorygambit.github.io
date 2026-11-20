export type FlowState = "bored" | "flow" | "anxious";

/** How far challenge may sit from skill and still feel like flow. */
export const BAND = 1.2;

export class Flow {
  static state(challenge: number, skill: number): FlowState {
    const d = challenge - skill;
    if (d < -BAND - 1e-9) return "bored";
    if (d > BAND + 1e-9) return "anxious";
    return "flow";
  }

  /**
   * Skill from tracking runs: the challenge at which the hit rate crosses the pass mark,
   * found by walking between the runs and interpolating.
   */
  static skillFrom(runs: readonly { c: number; h: number }[], mark = 0.65): number {
    const r = [...runs].sort((a, b) => a.c - b.c);
    if (r.every((x) => x.h >= mark)) return Math.min(10, r[r.length - 1]!.c + 1.5);
    if (r.every((x) => x.h < mark)) return Math.max(0, r[0]!.c - 1.5);
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i]!;
      const b = r[i + 1]!;
      if (a.h >= mark && b.h < mark) return a.c + ((a.h - mark) / (a.h - b.h)) * (b.c - a.c);
    }
    // The hit rate rose again after dipping. Use the last run that passed.
    return [...r].reverse().find((x) => x.h >= mark)!.c;
  }
}

/** The challenge of each tracking run, easy then middle then hard. */
export const LEVELS: readonly number[] = [1.5, 5, 9];

/** New people for Prove, as a skill on the same scale. */
export const PROVE_SKILLS: readonly number[] = [3, 7.5];
