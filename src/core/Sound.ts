import { prefs } from "./Store";

/**
 * A few soft sine voices, nothing more. Getting them to play on iPhone takes three things:
 *
 * 1. The AudioContext must be created and resumed inside a user gesture, and iOS only counts
 *    touchend, click and similar, not pointerdown. So the unlock listens on all of them,
 *    and keeps listening because iOS can suspend or "interrupt" the context again.
 * 2. Web Audio follows the ringer switch by default, so a phone on silent plays nothing.
 *    Setting the audio session type to "playback" ignores the switch. Change SESSION below
 *    to "ambient" if you would rather respect the switch and mix with other apps.
 * 3. A silent one sample buffer is played on unlock to wake the audio hardware.
 */
const SESSION: "playback" | "ambient" = "playback";

export class Sound {
  private static ctx: AudioContext | null = null;
  private static armed = false;

  static arm(): void {
    if (Sound.armed) return;
    Sound.armed = true;
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = SESSION;
    } catch {
      // Older Safari has no audioSession. The unlock below still works with the switch off.
    }
    for (const type of ["touchend", "pointerup", "click", "keydown"]) {
      window.addEventListener(type, Sound.unlock, { capture: true, passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) Sound.unlock();
    });
  }

  private static readonly unlock = (): void => {
    const ctx = Sound.context();
    if (!ctx) return;
    if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Harmless.
    }
  };

  private static context(): AudioContext | null {
    if (Sound.ctx) return Sound.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      Sound.ctx = new Ctor({ latencyHint: "interactive" });
    } catch {
      Sound.ctx = new Ctor();
    }
    return Sound.ctx;
  }

  private static voice(freq: number, dur: number, gain: number, delay = 0, to?: number): void {
    if (!prefs.getSnapshot().sound) return;
    const ctx = Sound.context();
    if (!ctx) return;
    // Called from a gesture handler, resume() is allowed. Schedule right away either way.
    if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
    const t0 = ctx.currentTime + delay + 0.005;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  static tap(): void {
    Sound.voice(520, 0.09, 0.07);
  }
  static pick(): void {
    Sound.voice(392, 0.14, 0.08, 0, 330);
  }
  static good(): void {
    Sound.voice(523, 0.22, 0.07);
    Sound.voice(784, 0.3, 0.06, 0.08);
  }
  static low(): void {
    Sound.voice(196, 0.3, 0.08, 0, 150);
  }
  static done(): void {
    Sound.voice(392, 0.35, 0.07);
    Sound.voice(523, 0.4, 0.06, 0.1);
    Sound.voice(659, 0.6, 0.055, 0.2);
  }
}
