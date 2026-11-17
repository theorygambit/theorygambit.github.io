import { prefs } from "./Store";

/**
 * A few soft sine voices, nothing more. iOS only starts audio inside a user
 * gesture, so the context is created and resumed from the first pointer events.
 */
export class Sound {
  private static ctx: AudioContext | null = null;
  private static armed = false;

  static arm(): void {
    if (Sound.armed) return;
    Sound.armed = true;
    const unlock = () => {
      const ctx = Sound.context();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchend", unlock, { passive: true });
  }

  private static context(): AudioContext | null {
    if (Sound.ctx) return Sound.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    Sound.ctx = new Ctor();
    return Sound.ctx;
  }

  private static voice(freq: number, dur: number, gain: number, delay = 0, to?: number): void {
    if (!prefs.getSnapshot().sound) return;
    const ctx = Sound.context();
    if (!ctx || ctx.state !== "running") return;
    const t0 = ctx.currentTime + delay;
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
    Sound.voice(520, 0.09, 0.05);
  }
  static pick(): void {
    Sound.voice(392, 0.14, 0.06, 0, 330);
  }
  static good(): void {
    Sound.voice(523, 0.22, 0.05);
    Sound.voice(784, 0.3, 0.04, 0.08);
  }
  static low(): void {
    Sound.voice(196, 0.3, 0.06, 0, 150);
  }
  static done(): void {
    Sound.voice(392, 0.35, 0.05);
    Sound.voice(523, 0.4, 0.045, 0.1);
    Sound.voice(659, 0.6, 0.04, 0.2);
  }
}
