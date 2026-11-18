import { prefs } from "./Store";

const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Haptics on the web, two ways:
 *
 * - Android and desktop Chrome: navigator.vibrate.
 * - iPhone: Safari has no Vibration API, so there is nothing to call. Since iOS 17.4 a
 *   native switch control (<input type="checkbox" switch>) gives a light tap whenever it
 *   is toggled by a real user gesture. We keep one hidden and click its label. This only
 *   fires inside a tap, a release or a click, never from a timer or animation frame, so
 *   call these from input handlers. Users also need System Haptics on in
 *   Settings, Sounds and Haptics.
 */
export class Haptics {
  private static label: HTMLLabelElement | null = null;

  static tick(): void {
    Haptics.pulse([1]);
  }
  static soft(): void {
    Haptics.pulse([1]);
  }
  static confirm(): void {
    Haptics.pulse([1, 70, 1]);
  }
  static warn(): void {
    Haptics.pulse([1, 90, 1, 90, 1]);
  }

  /** Gaps are in ms, and every odd entry is a pulse. */
  private static pulse(pattern: number[]): void {
    if (!prefs.getSnapshot().haptics) return;
    try {
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(pattern.map((v, i) => (i % 2 === 0 ? 10 : v)));
        return;
      }
      if (!isIOS()) return;
      let at = 0;
      pattern.forEach((v, i) => {
        if (i % 2 === 1) {
          at += v;
          return;
        }
        if (at === 0) Haptics.switchTap();
        else setTimeout(() => Haptics.switchTap(), at);
      });
    } catch {
      // Blocked by policy or an old OS. Silent fallback.
    }
  }

  private static switchTap(): void {
    if (!Haptics.label) {
      const label = document.createElement("label");
      label.setAttribute("aria-hidden", "true");
      label.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("switch", "");
      input.tabIndex = -1;
      label.appendChild(input);
      document.body.appendChild(label);
      Haptics.label = label;
    }
    Haptics.label.click();
  }
}
