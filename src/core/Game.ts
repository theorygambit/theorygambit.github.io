import { EventBus } from "./EventBus";
import { Caption } from "./Caption";
import { CanvasButton } from "./CanvasButton";
import type { Colors } from "./Palette";
import { Type, type Painter } from "./Painter";
import type { Rng } from "./Rng";
import { Damped } from "./Damped";

/** The three beats every game teaches through. See docs/FOUNDATION.md. */
export type Beat = "feel" | "see" | "prove";
export const BEATS: readonly Beat[] = ["feel", "see", "prove"];
const BEAT_LABEL: Record<Beat, string> = { feel: "Feel", see: "See", prove: "Prove" };

export interface GameEvents extends Record<string, unknown> {
  beat: Beat | "done";
  announce: string;
  complete: undefined;
}

/** Everything a game is allowed to touch. Games never reach into the DOM. */
export interface GameEnv {
  rng: Rng;
  bus: EventBus<GameEvents>;
}

/**
 * Base class for every game. A game is a small state machine that owns its
 * logic (in a pure model class) and its drawing. It moves through Feel, See and
 * Prove, and only completes once the player has applied the idea to a new case.
 */
export abstract class Game {
  abstract readonly slug: string;
  protected w = 0;
  protected h = 0;
  protected time = 0;
  protected beat: Beat | "done" = "feel";
  protected readonly env: GameEnv;
  protected readonly buttons: CanvasButton[] = [];
  protected readonly prompt = new Caption(Type.display(25), 30, "ink");
  protected readonly note = new Caption(Type.body(14, 300), 21, "fog");
  private readonly beatPos = new Damped(0, 0.35);
  private pressed: CanvasButton | null = null;

  constructor(env: GameEnv) {
    this.env = env;
  }

  /** Called once after construction and again on restart. */
  abstract begin(): void;
  protected abstract layout(): void;
  protected abstract tick(dt: number): void;
  protected abstract render(p: Painter, c: Colors): void;
  protected onDown(_x: number, _y: number): void {}
  protected onMove(_x: number, _y: number): void {}
  protected onUp(_x: number, _y: number): void {}
  /** Debug and test hook: jump straight to a beat. */
  abstract debugGoto(beat: Beat): void;

  /** Content column: a centred strip no wider than 440 css px. */
  protected get colW(): number {
    return Math.min(this.w - 40, 440);
  }
  protected get colX(): number {
    return (this.w - this.colW) / 2;
  }
  protected get cx(): number {
    return this.w / 2;
  }

  protected add<T extends CanvasButton>(b: T): T {
    this.buttons.push(b);
    return b;
  }

  protected setBeat(beat: Beat | "done"): void {
    this.beat = beat;
    this.beatPos.set(beat === "done" ? 3 : BEATS.indexOf(beat));
    this.env.bus.emit("beat", beat);
  }

  protected announce(message: string): void {
    this.env.bus.emit("announce", message);
  }

  protected finish(): void {
    this.setBeat("done");
    this.env.bus.emit("complete", undefined);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.layout();
  }

  step(dt: number): void {
    this.time += dt;
    this.beatPos.step(dt);
    this.prompt.step(dt);
    this.note.step(dt);
    for (const b of this.buttons) b.step(dt);
    this.tick(dt);
  }

  draw(p: Painter, c: Colors): void {
    this.drawBeats(p, c);
    this.render(p, c);
    for (const b of this.buttons) b.draw(p, c);
  }

  pointerDown(x: number, y: number): void {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i]!;
      if (b.hit(x, y)) {
        this.pressed = b;
        b.down();
        return;
      }
    }
    this.onDown(x, y);
  }

  pointerMove(x: number, y: number): void {
    if (this.pressed) return;
    this.onMove(x, y);
  }

  pointerUp(x: number, y: number): void {
    if (this.pressed) {
      const b = this.pressed;
      this.pressed = null;
      b.up();
      if (b.hit(x, y)) b.onPress();
      return;
    }
    this.onUp(x, y);
  }

  dispose(): void {}

  /** Feel, See, Prove: three marks with a hairline that fills as the lesson moves on. */
  private drawBeats(p: Painter, c: Colors): void {
    const x0 = this.colX;
    const w = this.colW;
    const y = 26;
    const step = w / 3;
    const pos = this.beatPos.value;
    const ly = y + 4;
    const by = y + 22;
    p.rule(x0, by, x0 + w, by, c.ink, 0.14);
    p.rect(x0, by, Math.max(0, Math.min(w, (pos + 0.001) * step)), p.hair, c.ink, 0.9);
    BEATS.forEach((b, i) => {
      const done = pos > i + 0.5;
      const active = Math.abs(pos - i) < 0.5;
      const lx = x0 + i * step;
      p.disc(lx + 3, ly, 3, c.ground);
      if (done) p.disc(lx + 3, ly, 3, c.ink);
      else p.ring(lx + 3, ly, 3, c.ink, 1, active ? 1 : 0.4);
      p.text(BEAT_LABEL[b], lx + 12, ly, { font: Type.body(12, 400), color: active ? c.ink : c.fog, base: "middle", alpha: active ? 1 : 0.7 });
    });
  }
}
