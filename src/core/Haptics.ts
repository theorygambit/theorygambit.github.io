import { prefs } from "./Store";

/** Android vibrates, iOS Safari ignores the call. Both are safe. */
export class Haptics {
  static tick(): void {
    Haptics.buzz(8);
  }
  static confirm(): void {
    Haptics.buzz([10, 40, 14]);
  }
  static soft(): void {
    Haptics.buzz(5);
  }
  private static buzz(pattern: number | number[]): void {
    if (!prefs.getSnapshot().haptics) return;
    try {
      if ("vibrate" in navigator) navigator.vibrate(pattern);
    } catch {
      // Blocked by policy. Silent fallback.
    }
  }
}
