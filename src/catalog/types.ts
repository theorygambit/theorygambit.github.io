export type ChapterId = "map" | "solutions" | "classics" | "time" | "information" | "coalitions" | "mind" | "frames" | "algorithms" | "craft";

/** 1 = Intro, 2 = Core, 3 = Advanced, the same scale as The Gambit. */
export type Level = 1 | 2 | 3;

/** The shape synced from The Gambit. */
export interface TopicEntry {
  slug: string;
  name: string;
  chapter: ChapterId;
  level: Level;
  idea: string;
}

export type Tier = "foundations" | "core" | "advanced" | "synthesis";

export interface CatalogItem extends TopicEntry {
  /** 1 based position in the whole curriculum. */
  order: number;
  tier: Tier;
  /** Synthesis games mix several theories and have no single Gambit entry. */
  kind: "topic" | "synthesis";
  mixes: string[];
}

export interface ChapterInfo {
  id: ChapterId;
  numeral: string;
  title: string;
}
