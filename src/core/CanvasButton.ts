import { Damped } from "./Damped";
import type { Colors } from "./Palette";
import { Type, type Painter } from "./Painter";

export type ButtonKind = "primary" | "ghost";

/** A control drawn inside the gameplay canvas, so its text is as crisp as the game. */
export class CanvasButton {
  x = 0;
  y = 0;
  w = 120;
  h = 44;
  label: string;
  kind: ButtonKind;
  enabled = true;
  visible = true;
  readonly onPress: () => void;
  private readonly shown = new Damped(0, 0.2);
  private readonly press = new Damped(0, 0.07);

  constructor(label: string, onPress: () => void, kind: ButtonKind = "ghost") {
    this.label = label;
    this.onPress = onPress;
    this.kind = kind;
  }

  place(x: number, y: number, w: number, h = 44): this {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    return this;
  }

  hit(px: number, py: number): boolean {
    return this.visible && this.enabled && this.shown.value > 0.5 && px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  down(): void {
    this.press.set(1);
  }

  up(): void {
    this.press.set(0);
  }

  step(dt: number): void {
    this.shown.set(this.visible ? 1 : 0);
    this.shown.step(dt);
    this.press.step(dt);
  }

  draw(p: Painter, c: Colors): void {
    const a = this.shown.value * (this.enabled ? 1 : 0.35);
    if (a < 0.01) return;
    if (this.kind === "primary") {
      p.rect(this.x, this.y, this.w, this.h, c.ink, a * (1 - this.press.value * 0.18));
      p.text(this.label, this.x + this.w / 2, this.y + this.h / 2, { font: Type.body(14, 400), color: c.ground, align: "center", base: "middle", alpha: a });
    } else {
      p.rect(this.x, this.y, this.w, this.h, c.ink, a * this.press.value * 0.1);
      p.frame(this.x, this.y, this.w, this.h, c.ink, a * 0.55);
      p.text(this.label, this.x + this.w / 2, this.y + this.h / 2, { font: Type.body(14, 400), color: c.ink, align: "center", base: "middle", alpha: a });
    }
  }
}
