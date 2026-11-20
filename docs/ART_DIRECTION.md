# Art direction

The site's Abyssal Liturgy brand: black and white for interface and games, with a warm champagne rose reserved for the hero, logo and icons.

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

## Home: The Approach

The hero is one scene, `src/ui/heroScene.ts`: a small physics simulation drawn in a canvas, shared with the promo banner (`tools/make-banner.mjs`). No figures. Seduction through geometry: tension kept just short of release.

- **Palette.** Void and Bone only, exactly the brand. One hairline. One soft light from above.
- **Cast.** A downward triangle (the old sign for water, the feminine) is the still, angular body. Three hairline threads are the soft body: each follows the path of a damped head that orbits, leans in, dwells, and slides along the edges holding a gap of a few pixels. Five echo triangles trail the main one like silk. Five opened rings (the brand mark) surround it.
- **Physics.** Critically damped springs everywhere, nothing bounces. The gap is a real collision margin (signed distance to the triangle). The thread pushes back on the triangle, so it shivers when brushed. Ripples travel at a fixed speed and leave nodes of light where they cross a ring.
- **Seduction rules.** Proximity without contact. Slow push and pull with long dwells. Lag and follow-through. Breath (0.2 Hz) always; a heartbeat while held. An opening that turns toward you. Never fast, never loud.
- **Touch.** Press: ripple, small start, the thread leaves the triangle to circle your fingertip a few pixels off, the triangle turns a vertex toward you, ring gaps open toward you. Hold: arousal rises, everything draws closer, the heartbeat starts. Release: it unwinds slowly. Mouse hover is the lighter version. Vertical swipes still scroll. Reduced motion shows the finished still frame.
- **Mark.** App icon and favicon are the same idea frozen: triangle, opened rings, one thread stopping a hair short of a vertex. Regenerate with `node tools/make-icons.mjs`.

## Sound and touch

Soft sine tones only, mutable. Vibration is a tick, never a buzz. Touch targets are at least 44 css pixels.
