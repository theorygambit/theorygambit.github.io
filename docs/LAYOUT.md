# Layout

**Rule zero: text must never touch text, and text must never touch a shape.** Not on any phone, not in any state of any game. This is checked by a program, not by eye. Read this before drawing anything in a game.

## Why this exists

The first versions placed things by hand: a note at `h - 182`, a button at `h - 80`, a plot 190 pixels from the top. That worked on a tall test canvas and broke on a real iPhone in Safari, where the browser bars leave a canvas only about 560 pixels tall. Labels landed on arrows, notes landed on charts, and everything looked compressed. Patching coordinates only moves the collision, so the fix is structural.

## The frame

Every game gets a `Frame` from `Game.frame`, computed from the real canvas height. It splits the canvas into fixed zones.

```
 y = 0
 +---------------------------+  beats bar (Feel, See, Prove)
 |  prompt, at most 2 lines  |  f.promptY
 +---------------------------+  f.top
 |                           |
 |   BODY: the only place    |
 |   a figure may be drawn   |  height f.h
 |                           |
 +---------------------------+  f.bottom
 |  note, at most 2 lines    |  f.noteY
 +---------------------------+
 |  action row               |  f.actionY, height f.actionH
 |  (one button, or pair())  |
 +---------------------------+
 |  ticks                    |  f.tickY
 +---------------------------+  y = h
```

- Prompt, note, buttons and ticks are drawn or placed **for you**. A game draws its figure in `render(p, c, f)` and nothing else.
- **Never** write `this.h - 150` or a fixed y. Position everything from `f.top`, `f.bottom`, `f.h`, `f.x` and `f.w`.
- A beat that uses two choice boxes instead of a button overrides `actionH`, then uses `this.pair(0)` and `this.pair(1)`. A single button is placed at `this.buttonY`.
- Below 500 pixels of height the frame turns compact (smaller prompt, tighter zones). Supported canvas heights start at 420.

Real canvas heights seen on phones: about 700 (home screen app), 586 (Safari with bars), 526 (Safari, short), 446 (iPhone SE, Safari). The verifier covers all of them plus a large phone, a small Android phone and an iPad.

## Drawing rules

1. **Size the figure from the body.** Radii, cell sizes and gaps are computed from `f.h` and `f.w` with a `clamp`. A figure that needs 270 pixels must shrink gracefully when it has 190, never overflow.
2. **Clear space of 3 pixels** between any text and any other shape, line or text. The auditor enforces it. Aim for 8 or more.
3. **Margins inside axes.** Keep data points at least 30 pixels inside the axes so a point and its label never touch an axis line. Use wide rectangles, not squares, when labels need room.
4. **Label on the safe side.** Put a label on the side of its point that has no arrow, line or neighbour. Arrows leave a point in a known direction, so the label goes opposite. Prefer short labels: a noun, not a sentence.
5. **Numbers belong in a fixed place.** Corner numbers in a matrix cell stay in the corner and discs are capped so they never reach it (`MatrixView.maxR`).
6. **Labels that follow data** (such as "you" on a marker) go directly above or below the marker, never beside it where a line passes.
7. **Remove content before shrinking type.** Minimum font is 11px. If a state does not fit, drop a label, merge two lines, or move information to the note.
8. **Prompts and notes are at most two lines** at the narrowest width (360px). About 55 characters for a prompt, 70 for a note. Shorten the words, not the font.
9. **One idea per screen.** If a beat needs more than about six labels, split it into steps the player advances with a tap.
10. **Draw through `Painter`.** Use `p.text`, `p.disc`, `p.ring`, `p.line`, `p.rule`, `p.frame`, `p.rect`, `p.path` (polylines and curves) and `p.dashedRing`. Anything drawn with the raw 2D context is invisible to the auditor. Do not do it near text.

## The auditor

When the page has `?audit` in its address, the painter records every text box, disc, ring, line and filled rectangle for each frame, then reports:

- text too close to or overlapping other text
- text overlapping or too close to a disc, a ring, a line, an arrow or a curve
- text straddling the edge of a filled shape (text fully inside a button is fine)
- text leaving the canvas
- a prompt or note wrapping to more than two lines

Results are on `window.__tgViolations` and `window.__tgCaptions`.

### Run it

```
npm run build && npm run preview     # one terminal
npm run verify:layout                # another
GAMES=stag-hunt npm run verify:layout   # one game
```

`tools/verify-layout.mjs` opens every game at seven screen sizes, drives it through every beat and the states between (a revealed round, a wrong answer, a solved puzzle, a finished animation) and exits non zero on any problem. It prints the screen size, game, state and the exact complaint.

### New games must be added to it

Add a `STATES` entry for the game in `tools/verify-layout.mjs`: every beat, plus every state that shows different text or shapes (each reveal, each wrong and right answer, each end state). A game is not done until it passes on all sizes.

## Common fixes

| Complaint | Fix |
|---|---|
| `text X is too close to text Y` | Move one onto another row, shorten it, or reduce the number of labels. |
| `a line is on or too close to text X` | Move the label to the side away from the line, or draw the line shorter. |
| `text X overlaps a disc` | Cap the disc radius, or move the label out by the disc radius plus 8. |
| `text X leaves the canvas` | Align it left or right to its anchor, not centred, or shorten it. |
| `prompt wraps to 3 lines` | Shorten the prompt. Never lower the font. |
| Figure collides with the note | The figure is using more than `f.h`. Size it from `f.h`. |
