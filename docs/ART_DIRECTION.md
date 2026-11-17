# Art direction

The site's Abyssal Liturgy brand, in black and white, followed to the letter.

## Colour

Dark is the brand. Light is its exact inverse.

| Token | Dark | Light |
| --- | --- | --- |
| Ground | Void `#08090b` | Bone `#e6e3da` |
| Ink | Bone `#e6e3da` | Void `#08090b` |
| Fog (secondary) | `#9aa3a8` | `#363e43` |
| Ash (tertiary) | `#7f8589` | `#4c555b` |

All text pairs are at least 4.5:1. Colours live in `src/styles/tokens.css`. Games read them through `Palette`. Never hard code a colour in a game.

## Type

- **Cormorant Garamond italic 300**: titles, prompts, takeaways.
- **Jost 300 and 400**: labels, body, buttons.
- **JetBrains Mono 400**: numbers and formulas.

Load only these weights. `font-synthesis: none` is set so the browser never fakes a bold.

## Shape and motion

- Discs, rings, hairlines. One idea per shape. Area carries value.
- Hairline is exactly one device pixel. Square corners.
- Motion is critically damped (`Damped`). No bounce, no overshoot, no snap. Durations feel like breathing: 0.3 to 0.6 seconds.
- Reveals fade or grow. They never slide text.
- One soft light from above and a coarse grain on the ground. Nothing else is decorative.
- Generous negative space. A screen holds one question.

## Home

A hero mark (concentric rings with a gap) and the wordmark, both drawn in a canvas over a faint contour field. Below, solid rows joined by hairline seams.

## Sound and touch

Soft sine tones only, mutable. Vibration is a tick, never a buzz. Touch targets are at least 44 css pixels.
