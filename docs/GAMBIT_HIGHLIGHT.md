# Highlighting the game on the Gambit page

This repo does not edit the Gambit repo. When ready, add a block at the top of the Gambit page (`src/pages/Gambit/Gambit.tsx`) in that repo. Suggested content, in the brand's style:

```tsx
<a className="gambit-play" href="https://theorygambit.github.io" target="_blank" rel="noreferrer">
  <span className="gambit-play-title">Theory Gambit</span>
  <span className="gambit-play-line">Learn each theory by playing it. A short game for every topic.</span>
</a>
```

Deep link a single topic with `https://theorygambit.github.io/#/g/<slug>`. A topic with no game yet opens an empty slot screen that links back to its Gambit entry, so links are safe to add before every game exists.

Style it as a hairline bordered block on the Void ground with Cormorant italic for the title and Jost 300 for the line, matching the existing hero cards.
