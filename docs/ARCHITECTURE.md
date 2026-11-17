# Architecture

Vite 8, React 19, TypeScript 6, no runtime dependencies besides React. Everything else is hand written classes.

```
src/
  core/        Engine layer. No React.
    Game.ts          Abstract Game: beats, buttons, captions, pointer routing.
    Runtime.ts       Hosts one Game on one canvas: sizing, loop, first pointer only.
    Surface.ts       1:1 device pixel canvas.   Painter.ts  Snapped text, hairlines, discs.
    Damped.ts        Critically damped motion and Signals (Lag CHOP style).
    Rng.ts           Seeded random.             math.ts     Easing, normal distribution.
    Registry.ts      GameRegistry: slug -> module.
    Store.ts         Prefs and progress (localStorage, useSyncExternalStore ready).
    Theme.ts / Palette.ts   Theme and canvas colours, read from CSS tokens.
    Viewport.ts      --app-h and the ?debug=layout report.   GestureGuard.ts   Touch rules.
    Sound.ts / Haptics.ts   Soft sine voices, vibration.
  catalog/     All topics.
    entries.ts       GENERATED from The Gambit (npm run sync:catalog). Do not edit.
    curriculum.ts    Order, tiers, finale and synthesis. The only place that knows order.
  games/       One folder per game: model.ts, <Name>Game.ts, index.ts (module + theory).
    shared/          MatrixView and glyphs used by several games.
  td/          WebGL2 background network (Noise, Feedback, Level), decorative only.
  theory/      TheoryEntry type.
  ui/          React shell: Home, GameScreen, TheorySheet, Hero, Router, Icons, DebugOverlay.
  styles/      tokens.css (single source of colour) and app.css.
tools/         test-models.ts, verify-iphone.mjs, sync-catalog.mjs, make-icons.mjs
docs/          You are here.
```

## Data flow

React never reaches into a game. `GameScreen` creates a `GameRuntime`, which creates the `Game` through the registry. The game talks upward only through a typed `EventBus` (`beat`, `announce`, `complete`). `complete` marks progress and lights the Next button.

## The Game class

A game is a small state machine over `Beat = "feel" | "see" | "prove"` plus `"done"`. Subclasses implement `begin`, `layout`, `tick`, `render` and `debugGoto`, and may override `onDown`, `onMove`, `onUp`. In game controls are `CanvasButton`s so their text is as crisp as the game. Text blocks that change use `Caption`, which fades in.

## The curriculum

`Curriculum.all()` returns every topic in app order: the five opening games, then the rest of Level 1, Level 2, Level 3 in Gambit order, then the finale (hypergames and metagames), then synthesis capstones. Tiers are Foundations, Core, Advanced, Synthesis. A topic with no registered game is an empty slot and shows as a row in the Library that opens an "empty slot" screen with the idea and a Gambit link.

## Testing

`npm test` runs `tools/test-models.ts` on pure models and the curriculum. `npm run verify:iphone` runs the iPhone contract in headless Chromium. CI runs lint, typecheck, tests and build before deploying.
