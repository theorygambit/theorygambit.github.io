import type { ChapterId, ChapterInfo } from "./types";

export const CHAPTERS: ChapterInfo[] = [
  { id: "map", numeral: "I", title: "The Map of Games" },
  { id: "solutions", numeral: "II", title: "Solution Concepts" },
  { id: "classics", numeral: "III", title: "The Classic Games" },
  { id: "time", numeral: "IV", title: "Time, Repetition and Evolution" },
  { id: "information", numeral: "V", title: "Information and Mechanisms" },
  { id: "coalitions", numeral: "VI", title: "Coalitions and Bargaining" },
  { id: "mind", numeral: "VII", title: "The Human Mind" },
  { id: "frames", numeral: "VIII", title: "Frames and Infinite Play" },
  { id: "algorithms", numeral: "IX", title: "Algorithms" },
  { id: "craft", numeral: "X", title: "Design in Practice" },
];

export const chapterOf = (id: ChapterId): ChapterInfo => CHAPTERS.find((c) => c.id === id)!;
