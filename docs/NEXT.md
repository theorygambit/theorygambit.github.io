# Next

The five opening games are complete (001 to 005). Everything from 006 on is an empty slot in curriculum order.

## Shipped

| # | Game | Slug | Feel, See, Prove |
| --- | --- | --- | --- |
| 001 | Dominant Strategy | `dominant-strategy` | four rounds with counterfactuals, tap columns to see the better row, three new tables |
| 002 | Prisoner's Dilemma | `prisoners-dilemma` | three strangers, the payoff plane, drag the temptation below the reward |
| 003 | Matching Pennies | `matching-pennies` | sixteen rounds against a pattern reader, your own statistics and the tent, flip with chance and run 1000 rounds |
| 004 | Stag Hunt | `stag-hunt` | five partners with records, the lines crossing at hare over stag, find the switch point for new payoffs |
| 005 | Ultimatum | `ultimatum` | five responders, probe the acceptance and earnings curves, price two new crowds |

## Suggested next batch (006 onward, still Level 1)

Follow `curriculum.ts`. The next Intro level topics are, in order: What Is a Game, Rationality and Common Knowledge, Normal vs Extensive Form, Zero Sum, Positive Sum, Negative Sum, Simultaneous vs Sequential, and so on. Reuse what exists:

- `MatrixView` for any 2x2 table. `Glyph` for the visual grammar.
- The reveal pattern: Feel collects evidence with a counterfactual, See is built from the player's own moves and needs a tap or drag, Prove changes the numbers.
- `Timeline` in Matching Pennies is a good base for any repeated game (for example Axelrod's tournament).
- The Stag Hunt and Ultimatum chart code is a good base for any "find the crossing or the peak" idea.

Follow `docs/ADDING_A_GAME.md`. Keep the model pure and tested.

## Known follow ups

- Fonts load from Google Fonts. Self host them if offline use matters.
- Add a short "how this was understood" streak or recap on the home screen once more games exist.
- Synthesis capstones (Frames Within Frames, The Whole Board) come last.
