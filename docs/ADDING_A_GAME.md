# Adding a game

Example slug: `prisoners-dilemma`. The slug must match a topic in `src/catalog/entries.ts`.

1. **Design on paper first.** Write the Feel, See and Prove beats and what the player must do in each. Pass the checklist in `FOUNDATION.md`.
2. **Model.** `src/games/<slug>/model.ts`. Pure TypeScript, no DOM. Holds payoffs, best replies, generators for Prove puzzles. Constructor fields are declared explicitly (the build forbids parameter properties).
3. **Tests.** Add a section to `tools/test-models.ts` proving the model matches the theory, including that Prove puzzles always have the intended answer and that a remembered answer fails on a new case.
4. **Game class.** `src/games/<slug>/<Name>Game.ts` extends `Game`. Implement `begin`, `layout`, `tick`, `render(p, c, f)`, `debugGoto`. Draw the figure only inside the frame body (`f.top` to `f.bottom`) and size everything from `f.h` and `f.w`. Read `LAYOUT.md` first. Use `this.prompt` and `this.note` for text, `this.add(new CanvasButton(...))` for controls, `this.setBeat(...)` for beats and `this.finish()` when Prove passes. Use `Damped` for all motion. Keep prompts short.
5. **Module.** `src/games/<slug>/index.ts` exports a `GameModule` with `slug`, `hook` (one line) and `theory` (a `TheoryEntry`).
6. **Register.** Add it to the list in `src/games/index.ts`.
7. **Glyph.** Add a case in `GameGlyph` in `src/ui/Icons.tsx` (24 unit grid, shown at 48px).
8. **Layout states.** Add a `STATES` entry to `tools/verify-layout.mjs` covering every beat and every state that shows different text or shapes.
9. **Verify.** `npm test && npm run typecheck && npm run lint && npm run build`, then `npm run preview` and in another terminal `npm run verify:iphone && npm run verify:layout`. Play it in dark and light on a phone.

Order in the app comes only from `src/catalog/curriculum.ts`. To move a topic, edit `FIRST`, `FINALE` or the synthesis lists there.

## Helpers to reuse

- Tap targets: override `zonesActive()` to return boxes (choice boxes from `this.cells(n, i)`, table cells, map corners, points) and handle `onZone(i)`. The base class does hit testing and the press highlight (`this.armedZone`).
- `this.ticks(p, c, count, done, active)` draws progress dots in the tick row.
- `PayoffPlane` (shared) for you/they outcome plots, `Track` for a draggable ruler, `MatrixView` for 2x2 tables.
- If a beat changes the action row height (choice boxes vs one button), override the `actionH` getter. The base class re-lays out automatically.

## Syncing topics from The Gambit

`node tools/sync-catalog.mjs ../hassanireza.github.io` regenerates `src/catalog/entries.ts`. It replaces dashes in copy so the no em dash rule holds.

## Debugging a game

Open the app with `?debug=1` (and `?audit` to print layout problems on `window.__tgViolations`). The running game is on `window.__tg.game`, so `__tg.game.debugGoto("prove")` jumps straight to a beat.
