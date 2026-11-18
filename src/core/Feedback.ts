import { Haptics } from "./Haptics";
import { Sound } from "./Sound";

/**
 * One place for sound plus haptics. Taps are debounced against the meaningful cues
 * (good, bad, done), so a correct answer gives one cue, not a tap on top of it.
 * Call these from input handlers: iOS only allows haptics and audio inside a gesture.
 */
export class Feedback {
  private static last = 0;

  static arm(): void {
    Sound.arm();
  }

  private static stamp(): void {
    Feedback.last = performance.now();
  }

  /** Any press or release. Skipped when a cue just fired in the same gesture. */
  static tap(): void {
    if (performance.now() - Feedback.last < 120) return;
    Feedback.stamp();
    Sound.tap();
    Haptics.tick();
  }

  static good(): void {
    Feedback.stamp();
    Sound.good();
    Haptics.confirm();
  }

  static bad(): void {
    Feedback.stamp();
    Sound.low();
    Haptics.warn();
  }

  static done(): void {
    Feedback.stamp();
    Sound.done();
    Haptics.confirm();
  }
}
