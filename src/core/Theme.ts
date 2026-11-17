import { Palette } from "./Palette";
import { prefs } from "./Store";

export type ThemeName = "dark" | "light";

const META: Record<ThemeName, string> = { dark: "#08090b", light: "#e6e3da" };

/** Dark by brand, light as its inverse. Follows the device until the player chooses. */
export class ThemeController {
  private media: MediaQueryList | null = null;

  effective(): ThemeName {
    const chosen = prefs.getSnapshot().theme;
    if (chosen) return chosen;
    return this.media?.matches ? "light" : "dark";
  }

  start(): void {
    this.media = window.matchMedia?.("(prefers-color-scheme: light)") ?? null;
    this.media?.addEventListener("change", () => this.apply());
    prefs.subscribe(() => this.apply());
    this.apply();
  }

  toggle(): void {
    prefs.setTheme(this.effective() === "dark" ? "light" : "dark");
  }

  apply(): void {
    const t = this.effective();
    const root = document.documentElement;
    root.dataset.theme = t;
    root.style.colorScheme = t;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[t]);
    Palette.read();
  }
}

export const theme = new ThemeController();
