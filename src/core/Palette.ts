import { EventBus } from "./EventBus";

/** Canvas colours, read from the CSS tokens so CSS stays the single source of truth. */
export interface Colors {
  ink: string;
  ground: string;
  fog: string;
  ash: string;
  line: string;
  faint: string;
  glow: string;
}

const FALLBACK: Colors = {
  ink: "#e6e3da",
  ground: "#08090b",
  fog: "#9aa3a8",
  ash: "#7f8589",
  line: "rgba(230,227,218,0.16)",
  faint: "rgba(230,227,218,0.06)",
  glow: "rgba(124,136,145,0.12)",
};

export class Palette {
  static colors: Colors = { ...FALLBACK };
  static readonly bus = new EventBus<{ change: Colors }>();

  static read(): Colors {
    const cs = getComputedStyle(document.documentElement);
    const get = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    Palette.colors = {
      ink: get("--c-ink", FALLBACK.ink),
      ground: get("--c-ground", FALLBACK.ground),
      fog: get("--c-fog", FALLBACK.fog),
      ash: get("--c-ash", FALLBACK.ash),
      line: get("--c-line", FALLBACK.line),
      faint: get("--c-faint", FALLBACK.faint),
      glow: get("--c-glow", FALLBACK.glow),
    };
    Palette.bus.emit("change", Palette.colors);
    return Palette.colors;
  }
}
