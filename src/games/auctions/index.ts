import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { AuctionsGame } from "./AuctionsGame";

const theory: TheoryEntry = {
  idea: "In a sealed bid auction where you pay what you bid, bidding your full value wins but earns nothing. The best bid shades below your value, and the more rivals there are, the less you shade. This is why four different formats can pay the seller the same on average.",
  taught: [
    { beat: "Feel", text: "Three first price auctions against one rival. You see your value and choose a bid." },
    { beat: "See", text: "Drag your bid and watch expected profit rise, peak and fall. The peak sits at half your value." },
    { beat: "Prove", text: "More bidders and new values. Drag to the best bid." },
  ],
  math: [
    { label: "n bidders, values uniform 0 to 1", expr: "each rival bids (n - 1) / n of their value" },
    { label: "Chance a bid b wins", expr: "(b / shade) to the power n - 1, capped at 1" },
    { label: "Expected profit", expr: "(value - b) x chance of winning" },
    { label: "Best bid", expr: "(n - 1) / n x value" },
    { label: "Seller revenue", expr: "(n - 1) / (n + 1) on average, in first price and second price alike" },
  ],
  remember: "Shade your bid by 1 over n. Winning cheaply beats winning often.",
  practice: "Ad auctions, procurement and spectrum sales all balance winning against paying. In a second price auction you simply bid your value, because the price is set by the rival.",
  origin: "Vickrey's 1961 paper introduced the second price auction and the revenue equivalence idea. Myerson's 1981 work generalised it and led to optimal auction design.",
};

export const auctions: GameModule = {
  slug: "auctions",
  hook: "Bid below your value, but how far?",
  create: (env) => new AuctionsGame(env),
  theory,
};
