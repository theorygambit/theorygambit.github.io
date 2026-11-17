# Foundation

Read this first, every session. These are the rules the app is built on. If a new game breaks one of them, the game is wrong, not the rule.

## What this is

Theory Gambit is a mobile first game app that sits on top of **The Gambit** (hassanireza.github.io/gambit). The Gambit has 116 game theory topics. This app will have one game for each of them, plus synthesis capstones that mix several theories. It deploys to https://theorygambit.github.io and is highlighted at the top of the Gambit page.

## The five principles

1. **A game must teach, not only show.** The player should leave understanding the theory well enough to apply it to a case they have not seen. A game that merely illustrates a theory, or wraps it in a score, has failed.
2. **Feel, See, Prove.** Every game has exactly these three beats, in this order, drawn in the progress bar at the top of the canvas.
   - **Feel**: the player plays first, with no explanation. They collect evidence with their own hands. Where possible, show the counterfactual (what the other choice would have paid).
   - **See**: the structure behind what they just did is revealed, built from their own moves. The player must act to reveal it (tap, drag). Nothing is explained by a wall of text.
   - **Prove**: the player applies the idea to a new case with different numbers. They cannot pass by remembering an answer. A wrong answer shows why, then lets them retry. Only passing Prove marks the theory as understood.
3. **Short and to the point.** One game is about 60 to 90 seconds. Prompts are one or two short sentences (under about 70 characters). No tutorials, no menus inside a game.
4. **Minimal and deep.** The art is extremely reduced (discs, rings, hairlines, whole numbers) and every shape carries meaning. Simple does not mean plain: motion, spacing and typography are art directed to the last pixel. See `ART_DIRECTION.md`.
5. **Logic lives in models.** Every game has a pure model class (no DOM, no canvas) that holds the theory, and a test that proves the model matches the theory. Rendering never decides who is right.

## Visual grammar (shared by every game)

- **You are the filled disc. The other player is the ring.**
- **A payoff is the area of a disc**, not its radius. Numbers sit small in the corner.
- Black and white only. Dark and light themes are exact inverses.
- Hairlines are one device pixel. Motion is critically damped: nothing bounces, nothing snaps.

## Hard technical rules

- TypeScript, React 19, object oriented. Games and engines are classes. React is only the shell.
- Games draw everything, including text, inside their own canvas. Never float page text over a canvas.
- Gameplay canvases are 1:1 with device pixels.
- No em dashes anywhere: code, copy, docs, commit messages.
- Do not touch other repositories. This repo is self contained. The only link out is the Gambit URL.
- Follow `IPHONE_CONTRACT.md` for any layout or animation change. `npm run verify:iphone` must pass.

## Content rules for theory text

- Plain words. One idea per sentence. Use the same terms as The Gambit.
- The Theory window explains the idea, how this game teaches it (one line per beat), the math, practice, and origin. Always link to the full Gambit entry.
- Never claim more than the game shows.

## Definition of done for a game

1. Model class plus tests in `tools/test-models.ts`.
2. Game class with Feel, See and Prove, and `debugGoto` for all three beats.
3. `TheoryEntry` written.
4. Registered in `src/games/index.ts`, with a glyph in `src/ui/Icons.tsx` and a one line hook.
5. Played once on a phone in both themes. `npm test`, `npm run typecheck` and `npm run verify:iphone` pass.
