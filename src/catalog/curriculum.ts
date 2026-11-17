import type { CatalogItem, Tier, TopicEntry } from "./types";
import { ENTRIES } from "./entries";

/**
 * The order of the whole app, easy to hard.
 *
 *  1. FIRST: the five games built first, all Level 1 in The Gambit.
 *  2. The rest of Level 1 in Gambit order, then Level 2, then Level 3.
 *  3. FINALE: the hardest ideas, hypergames and metagames, always last.
 *  4. SYNTHESIS: capstones that mix several theories in one game.
 *
 * To add a game, only write its module (see docs/ADDING_A_GAME.md). To move a
 * topic earlier or later, edit these lists. Nothing else knows about order.
 */
export const FIRST: readonly string[] = ["dominant-strategy", "prisoners-dilemma", "matching-pennies", "stag-hunt", "ultimatum"];

export const FINALE: readonly string[] = ["hypergame-theory", "hypergame-levels", "metagame-howard"];

export const SYNTHESIS: readonly TopicEntry[] = [
  {
    slug: "synthesis-frames",
    name: "Frames Within Frames",
    chapter: "frames",
    level: 3,
    idea: "Every player sees a different game. Beliefs, hidden types and levels of reasoning collide in one board.",
  },
  {
    slug: "synthesis-board",
    name: "The Whole Board",
    chapter: "frames",
    level: 3,
    idea: "Dominance, mixing, trust, fairness and frames all at once. The last game in the curriculum.",
  },
];

const SYNTHESIS_MIXES: Record<string, string[]> = {
  "synthesis-frames": ["hypergame-theory", "level-k", "signaling", "bayesian-games"],
  "synthesis-board": ["dominant-strategy", "matching-pennies", "stag-hunt", "ultimatum", "hypergame-levels", "metagame-howard"],
};

export class Curriculum {
  private static cache: CatalogItem[] | null = null;

  static all(): CatalogItem[] {
    if (Curriculum.cache) return Curriculum.cache;
    const bySlug = new Map(ENTRIES.map((e) => [e.slug, e] as const));
    const pinned = new Set([...FIRST, ...FINALE]);
    for (const slug of pinned) if (!bySlug.has(slug)) throw new Error(`Curriculum pins unknown topic: ${slug}`);

    const rest = ENTRIES.filter((e) => !pinned.has(e.slug));
    const byLevel = (l: 1 | 2 | 3) => rest.filter((e) => e.level === l);
    const ordered: TopicEntry[] = [
      ...FIRST.map((s) => bySlug.get(s)!),
      ...byLevel(1),
      ...byLevel(2),
      ...byLevel(3),
      ...FINALE.map((s) => bySlug.get(s)!),
    ];

    const tierOf = (e: TopicEntry): Tier => {
      if (FIRST.includes(e.slug) || (e.level === 1 && !FINALE.includes(e.slug))) return "foundations";
      return e.level === 2 ? "core" : "advanced";
    };

    const items: CatalogItem[] = ordered.map((e, i) => ({ ...e, order: i + 1, tier: tierOf(e), kind: "topic", mixes: [] }));
    SYNTHESIS.forEach((e, i) => items.push({ ...e, order: ordered.length + i + 1, tier: "synthesis", kind: "synthesis", mixes: SYNTHESIS_MIXES[e.slug] ?? [] }));
    Curriculum.cache = items;
    return items;
  }

  static get(slug: string | undefined): CatalogItem | undefined {
    return slug ? Curriculum.all().find((i) => i.slug === slug) : undefined;
  }

  static byTier(tier: Tier): CatalogItem[] {
    return Curriculum.all().filter((i) => i.tier === tier);
  }

  /** The next item after `slug` that satisfies `playable`, or undefined at the end. */
  static next(slug: string, playable: (slug: string) => boolean): CatalogItem | undefined {
    const all = Curriculum.all();
    const at = all.findIndex((i) => i.slug === slug);
    return all.slice(at + 1).find((i) => playable(i.slug));
  }
}

export const TIER_INFO: Record<Tier, { title: string; blurb: string }> = {
  foundations: { title: "Foundations", blurb: "Intro level. Choices, incentives and the first surprises." },
  core: { title: "Core", blurb: "Equilibrium, time, markets and bias." },
  advanced: { title: "Advanced", blurb: "Hidden types, mechanisms, algorithms and design." },
  synthesis: { title: "Synthesis", blurb: "Several theories at once. Hypergames and the whole board." },
};
