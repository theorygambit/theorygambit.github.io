# iPhone home screen app contract

Two separate bugs, both fixed by construction. Do not weaken any rule.

## 1. Size (empty strip at the bottom, content too high or low)

A home screen app can launch with a window shorter than the screen (innerHeight about 797 on an 844 screen).

- Never size the root with `100vh`, `100dvh` or `inset:0`.
- `src/core/Viewport.ts` measures: standalone, portrait, phone sets `--app-h = max(innerHeight, max(screen.width, screen.height))` on `<html>`. It re-runs on resize, orientationchange, and at 120, 400, 1000 and 2500 ms after launch.
- `html`, `body`, `#root`, the background canvas all use `height: var(--app-h, 100%)`. `#root` is `position: fixed; top: 0; left: 0; width: 100%`.
- The same gradient is painted on `<html>` and the app background.
- Meta: `viewport-fit=cover`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black-translucent`.
- Safe area: `padding-top: calc(env(safe-area-inset-top) + 8px)` on the content column only (`.home`, `.game`). Bottom the same with `safe-area-inset-bottom`. Never on a background or canvas.

## 2. Blur (soft text or controls)

Blur is a layer rendering problem. Do not move things to fix it.

- No text in a layer with an animation using transform, scale or filter, `will-change`, `translateZ` or CSS blur. The theory sheet opens by animating `max-height`, and its scrim (no text) fades. No page text is ever transformed.
- Text over a canvas is drawn in the canvas, scaled by devicePixelRatio, at whole pixel positions (`Painter.text`). The hero wordmark and every in game label work this way.
- Controls over a soft background get a solid background. All buttons are solid.
- SVG icons scale by whole numbers (24 unit viewBox at 24px or 48px).
- Gameplay canvases are 1:1: `canvas.width = css width * devicePixelRatio` (`Surface.fit`). Only the decorative `FieldNetwork` background is soft.
- Every font weight used is loaded. `font-synthesis: none`.

## 3. Touch

- Viewport has `maximum-scale=1, user-scalable=no`. `GestureGuard` blocks gesturestart, gesturechange, gestureend, contextmenu, selectstart.
- `user-select: none`, `-webkit-touch-callout: none` and `touch-action: none` on the play surface.
- Only the first pointer steers (`GameRuntime`).

## 4. Prove it without screenshots

`npm run build && npm run preview`, then `npm run verify:iphone`. It opens the app at viewport 390x797, screen 390x844, scale 3, touch on, `navigator.standalone` forced true, waits 2.5 s, and asserts:

- html, body, #root and the background canvas are at least 844px tall.
- The last visible control ends within 110px of the bottom.
- No infinite animation targets an element with text. No text element has will-change, filter or backdrop-filter.
- Gameplay canvases have a backing store to device pixel ratio of exactly 1.

Add `?debug=layout` to any URL to print innerHeight, screen height, visualViewport, safe area insets, `--app-h` and the gap under `#root`.

## 5. Cache

After every deploy that changes meta tags, icons or layout, **delete the home screen icon and add it again**. iOS keeps the old meta tags, icon and layout until then.

## Known iOS behaviour

With `black-translucent`, iOS draws the status bar text in a colour it chooses from the device appearance. The theme defaults to the device setting for this reason. If the player forces the opposite theme, the clock may be low contrast. This is an iOS limit.
