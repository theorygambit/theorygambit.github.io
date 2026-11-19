# Next

The five opening games (001 to 005) and slots 026 to 035 are complete. Slots 006 to 025 and everything from 036 on are empty, in curriculum order.

## Shipped

| # | Game | Slug | Feel, See, Prove |
| --- | --- | --- | --- |
| 001 | Dominant Strategy | `dominant-strategy` | four rounds with counterfactuals, tap columns to see the better row, three new tables |
| 002 | Prisoner's Dilemma | `prisoners-dilemma` | three strangers, the payoff plane, drag the temptation below the reward |
| 003 | Matching Pennies | `matching-pennies` | sixteen rounds against a pattern reader, your own statistics and the tent, flip with chance and run 1000 rounds |
| 004 | Stag Hunt | `stag-hunt` | five partners with records, the lines crossing at hare over stag, find the switch point for new payoffs |
| 005 | Ultimatum | `ultimatum` | five responders, probe the acceptance and earnings curves, price two new crowds |

| 026 | Information Types | `information-types` | four rounds that each hide the move, the payoffs, both or neither, replay each corner, classify three new games |
| 027 | Short vs Long Games | `short-long-games` | one stranger then four rounds with a partner who copies you, drag the rounds to see totals cross, find the break even for new payoffs |
| 028 | Iterated Elimination | `iterated-elimination` | three rows against a partner, strike what is always worse with the next strike hinted, solve two new 3x3 tables |
| 029 | Nash Equilibrium | `nash-equilibrium` | tap outcomes to see who would move, ring best replies, tap every stable cell of two new tables |
| 030 | Mixed Strategy | `mixed-strategy` | six penalty kicks against a keeper who reads your lean, drag the mix to the crossing, find the indifference share for new chances |
| 031 | Minimax Theorem | `minimax-theorem` | three rows against a hostile rival, floors and ceilings meet at a saddle, tap the saddle of two new tables |
| 032 | Backward Induction | `backward-induction` | a seven stone pile against a perfect opponent, label piles from zero, choose the winning take for new piles |
| 033 | Public Goods | `public-goods` | three rounds of giving with a zero gift counterfactual, you and group lines diverge, find the break even multiplier for new group sizes |
| 034 | Centipede | `centipede` | play a trusting partner, unravel from the last node, find where logic ends new games |
| 035 | Traveler's Dilemma | `travelers-dilemma` | three claims with the one lower counterfactual, drag their claim down the staircase, best reply for a new bonus and range |

Shared helpers added with these games: `Bimatrix` (any size payoff table with best replies, dominance and saddle), `GridView` (N by M table in the frame) and `Slider` (drag track), all in `src/games/shared`.

## Suggested next batch (006 to 025 first, then 036 onward)

Follow `curriculum.ts`. The next Intro level topics are, in order: What Is a Game, Rationality and Common Knowledge, Normal vs Extensive Form, Zero Sum, Positive Sum, Negative Sum, Simultaneous vs Sequential, and so on. Reuse what exists:

- `MatrixView` for any 2x2 table. `Glyph` for the visual grammar.
- The reveal pattern: Feel collects evidence with a counterfactual, See is built from the player's own moves and needs a tap or drag, Prove changes the numbers.
- `Timeline` in Matching Pennies is a good base for any repeated game (for example Axelrod's tournament).
- The Stag Hunt and Ultimatum chart code is a good base for any "find the crossing or the peak" idea.

Follow `docs/ADDING_A_GAME.md`. Keep the model pure and tested, draw inside the frame (`docs/LAYOUT.md`) and add the game to `tools/verify-layout.mjs`.

## Known follow ups

- Fonts load from Google Fonts. Self host them if offline use matters.
- Add a short "how this was understood" streak or recap on the home screen once more games exist.
- Synthesis capstones (Frames Within Frames, The Whole Board) come last.
