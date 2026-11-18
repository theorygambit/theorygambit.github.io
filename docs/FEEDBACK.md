# Sound and haptics

Both are small, mutable and optional. Both are also far stricter on iPhone than anywhere else, so read this before touching them.

## What iPhone Safari does

- **There is no Vibration API.** `navigator.vibrate` does not exist on iPhone, so calling it does nothing. Haptics on iPhone use a native switch control: since iOS 17.4 a hidden `<input type="checkbox" switch>` gives a light tap when it is toggled by a real user gesture. `Haptics` keeps one hidden and clicks its label.
- **Haptics and audio only work inside a gesture.** A tap, a release or a click qualifies. A timer, an animation frame or a game event does not. So feedback must be triggered from input handlers.
- **Web Audio must be unlocked by a gesture.** iOS counts `touchend`, `click` and similar, not `pointerdown`. `Sound.arm()` listens on all of them, resumes the context each time (iOS can suspend or interrupt it), and plays a silent one sample buffer to wake the hardware.
- **The silent switch mutes Web Audio.** `Sound` sets `navigator.audioSession.type = "playback"` so sound plays regardless. The trade off is that it can pause music from another app. Change `SESSION` in `src/core/Sound.ts` to `"ambient"` to mix with other audio and obey the switch instead.
- The player needs **System Haptics** on (Settings, Sounds and Haptics) for the haptic to be felt.

## How it is wired

- `Feedback` (src/core/Feedback.ts) is the one entry point: `tap`, `good`, `bad`, `done`. It debounces taps against cues so one action gives one cue.
- `main.tsx` adds one global click listener, so every button, link and summary gives a tap.
- `GameRuntime` calls `Feedback.tap()` on every pointer release on the canvas.
- A game calls `this.cue("good" | "bad")` from the input handler that decides an answer (a lock in, a button, a drag that crosses a threshold). Do **not** cue from `tick`: the sound plays but the haptic will not.
- `GameScreen` plays `Feedback.done()` when a game completes.
- Players can turn sound and haptics off. Both stores live in `src/core/Store.ts`.

## Testing without a phone

`navigator.vibrate` is absent in the iPhone user agent, the hidden switch toggles on a tap, an `AudioContext` reaches `running` after the first tap and oscillators are scheduled on every cue. A headless emulation of exactly this ran during development. Real iPhone checks still matter: test on a device with the ringer switch on silent, and with System Haptics off then on.
