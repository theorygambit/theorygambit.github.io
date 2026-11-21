import { EventBus } from "./EventBus";
import { Caption } from "./Caption";
import { CanvasButton } from "./CanvasButton";
import type { Colors } from "./Palette";
import { Type, type Painter } from "./Painter";
import type { Rng } from "./Rng";
import { Damped } from "./Damped";
import { Feedback } from "./Feedback";
import { inside, type Box } from "./Geometry";

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
 * The vertical layout of every game screen, computed from the real canvas height.
 * Games draw only inside `top` to `bottom` (the body). The prompt, the note, the
 * action row (buttons or choice boxes) and the ticks live in fixed zones around it,
 * so they can never collide with the body no matter how short the screen is.
 * See docs/LAYOUT.md.
 */
export interface Frame {
  compact: boolean;
  /** Content column. */
  x: number;
  w: number;
  /** First baseline of the prompt. */
  promptY: number;
  /** Body, the only area a game may draw its figure in. */
  top: number;
  bottom: number;
  h: number;
  /** First baseline of the note, which may use two lines. */
  noteY: number;
  /** Top of the action row and its height. */
  actionY: number;
  actionH: number;
  /** Centre of the tick row. */
  tickY: number;
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
  private lastActionH = -1;
  /** Index of the tap zone currently held down, for press highlights. */
  protected armedZone: number | null = null;

  constructor(env: GameEnv) {
    this.env = env;
  }

  /** Called once after construction and again on restart. */
  abstract begin(): void;
  /** Position buttons and compute geometry from `this.frame`. Called on resize and on every beat change. */
  protected abstract layout(): void;
  protected abstract tick(dt: number): void;
  /** Draw the figure. Stay inside f.top to f.bottom. Prompt, note and buttons are drawn for you. */
  protected abstract render(p: Painter, c: Colors, f: Frame): void;
  /** Tap zones for the current beat (choice boxes, table cells, points). Return null when there are none. */
  protected zonesActive(): Box[] | null {
    return null;
  }
  /** Called when a tap zone is pressed and released inside itself. */
  protected onZone(_i: number): void {}
  protected onDown(_x: number, _y: number): void {}
  protected onMove(_x: number, _y: number): void {}
  protected onUp(_x: number, _y: number): void {}
  /** Debug and test hook: jump straight to a beat. */
  abstract debugGoto(beat: Beat): void;

  /** Height of the action row. Override when a beat uses choice boxes instead of one button. */
  protected get actionH(): number {
    return 44;
  }

  protected get compact(): boolean {
    return this.h < 500;
  }

  get frame(): Frame {
    const compact = this.compact;
    const promptY = compact ? 62 : 84;
    const lineH = compact ? 24 : 30;
    const top = promptY + lineH + 8 + (compact ? 16 : 26);
    const actionH = this.actionH;
    const actionY = this.h - 30 - actionH;
    const noteLine = compact ? 19 : 21;
    const noteY = actionY - 14 - noteLine;
    const bottom = noteY - (compact ? 22 : 28);
    return { compact, x: this.colX, w: this.colW, promptY, top, bottom, h: Math.max(0, bottom - top), noteY, actionY, actionH, tickY: this.h - 16 };
  }

  /** Vertical centre of a single 44px button inside the action row. */
  protected get buttonY(): number {
    const f = this.frame;
    return f.actionY + (f.actionH - 44) / 2;
  }

  /** `n` equal boxes filling the action row, separated by 10px. */
  protected cells(n: number, i: number): Box {
    const f = this.frame;
    const bw = (f.w - 10 * (n - 1)) / n;
    return { x: f.x + i * (bw + 10), y: f.actionY, w: bw, h: f.actionH };
  }

  /** Draws the progress ticks in the tick row. */
  protected ticks(p: Painter, c: Colors, count: number, done: number, active: number): void {
    const f = this.frame;
    const x = this.cx - ((count - 1) * 20) / 2;
    for (let i = 0; i < count; i++) {
      p.disc(x + i * 20, f.tickY, 3, c.ground);
      if (i < done) p.disc(x + i * 20, f.tickY, 3, c.ink);
      else p.ring(x + i * 20, f.tickY, 3, c.ink, 1, i === active ? 1 : 0.35);
    }
  }

  /** Two equal choice boxes filling the action row. */
  protected pair(i: 0 | 1): Box {
    const f = this.frame;
    const bw = (f.w - 12) / 2;
    return { x: f.x + i * (bw + 12), y: f.actionY, w: bw, h: f.actionH };
  }

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
    if (this.w > 0) this.layout();
    this.env.bus.emit("beat", beat);
  }

  /** Sound and haptic for a meaningful moment. Call it from an input handler so iOS allows it. */
  protected cue(kind: "good" | "bad"): void {
    Feedback[kind]();
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
    const c = this.compact;
    this.prompt.setSize(Type.display(c ? 21 : 25), c ? 24 : 30);
    this.note.setSize(Type.body(c ? 13 : 14, 300), c ? 19 : 21);
    this.layout();
  }

  step(dt: number): void {
    // If a beat changes the height of the action row, buttons must move with it.
    const ah = this.actionH;
    if (ah !== this.lastActionH) {
      this.lastActionH = ah;
      if (this.w > 0) this.layout();
    }
    this.time += dt;
    this.beatPos.step(dt);
    this.prompt.step(dt);
    this.note.step(dt);
    for (const b of this.buttons) b.step(dt);
    this.tick(dt);
  }

  draw(p: Painter, c: Colors): void {
    const f = this.frame;
    this.drawBeats(p, c, f);
    this.prompt.draw(p, c, f.x, f.promptY, f.w);
    this.note.draw(p, c, this.cx, f.noteY, f.w, "center");
    this.render(p, c, f);
    for (const b of this.buttons) b.draw(p, c);
  }

  /** Lines used by the prompt and note on the last frame. The layout auditor keeps both at two or fewer. */
  get captionLines(): { prompt: number; note: number } {
    return { prompt: this.prompt.lines, note: this.note.lines };
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
    const zs = this.zonesActive();
    if (zs) {
      for (let i = 0; i < zs.length; i++) {
        if (inside(zs[i]!, x, y)) {
          this.armedZone = i;
          return;
        }
      }
    }
    this.onDown(x, y);
  }

  pointerMove(x: number, y: number): void {
    if (this.pressed) return;
    this.onMove(x, y);
  }

  pointerUp(x: number, y: number): void {
    if (this.armedZone !== null) {
      const i = this.armedZone;
      this.armedZone = null;
      const zs = this.zonesActive();
      if (zs && zs[i] && inside(zs[i]!, x, y)) this.onZone(i);
      return;
    }
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
  private drawBeats(p: Painter, c: Colors, f: Frame): void {
    const x0 = f.x;
    const w = f.w;
    const y = f.compact ? 14 : 26;
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
