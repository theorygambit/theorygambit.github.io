import type { GameModule } from "../../core/Registry";
import type { TheoryEntry } from "../../theory/types";
import { DollarAuctionGame } from "./DollarAuctionGame";

const theory: TheoryEntry = {
  idea: "A prize is sold to the highest bidder, but the second highest bidder pays their bid too. Each raise looks sensible once you are the runner up, yet together the bidders end up paying more than the prize is worth.",
  taught: [
    { beat: "Feel", text: "Bid for 100 against a rival who keeps topping you. Raise, or walk away, and see what you paid." },
    { beat: "See", text: "Drag along the bids and watch the winner, the runner up and the two together. The pair falls below zero at 55." },
    { beat: "Prove", text: "Two new prizes and bid steps. Find the first top bid where the two bids beat the prize." },
  ],
  math: [
    { label: "Prize P, bids in steps of s, top bid b, runner up b - s", expr: "winner nets P - b, runner up nets -(b - s)" },
    { label: "The auctioneer collects", expr: "b + (b - s) = 2b - s" },
    { label: "The pair together is behind once", expr: "2b - s > P, so b > (P + s) / 2" },
  ],
  remember: "When the runner up pays too, the best time to stop is early.",
  practice: "Arms races, price wars, lawsuits, bidding for attention and any contest where effort is lost even by the loser. Decide a limit before you start, and ask whether the next step pays, not whether the past steps can be recovered.",
  origin: "Described by Martin Shubik in 1971. A standard classroom demonstration of escalation of commitment.",
};

export const dollarAuction: GameModule = { slug: "dollar-auction", hook: "Why second place pays too much.", create: (env) => new DollarAuctionGame(env), theory };
