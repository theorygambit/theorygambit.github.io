import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside, type Box } from "../../core/Geometry";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { MATCH_PAYOFF, feelRounds, outcome, proveScenes, quadrant, ringSide, type InfoRound, type Scene, type Side } from "./model";

const COL_NAME = ["Perfect", "Imperfect"] as const;
const ROW_NAME = ["Complete", "Incomplete"] as const;
const CORNER_NOTE: Record<string, string> = {
  "0,0": "Nothing hidden. You always match.",
  "1,0": "Move hidden, payoffs known. Read the payoffs.",
  "0,1": "Move seen, payoffs hidden. Seeing was enough.",
  "1,1": "Both hidden. Nothing to go on but a guess.",
};

/**
 * Feel: four rounds of matching the other player's move. Each round hides the move, the payoffs, both or neither.
 * See: your four rounds sit on a grid of the two questions. Tap each corner to replay it.
 * Prove: three new games. Tap the corner each belongs to.
 */
export class InformationTypesGame extends Game {
  readonly slug = "information-types";
  private rounds: InfoRound[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private guess: Side | null = null;
  private got: number[] = [];
  private since = 0;
  private readonly ringX = new Damped(0.5, 0.4);
  private readonly open = new Damped(0, 0.45);
  private readonly intro = new Damped(0, 0.7);

  private seen = new Set<string>();
  private readonly pop: Damped[] = [new Damped(0, 0.4), new Damped(0, 0.4), new Damped(0, 0.4), new Damped(0, 0.4)];

  private scenes: Scene[] = [];
  private pi = 0;
  private pick: { x: 0 | 1; y: 0 | 1 } | null = null;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly mark = new Damped(0, 0.4);

  private readonly guessL = this.add(new CanvasButton("Left", () => this.play(0)));
  private readonly guessR = this.add(new CanvasButton("Right", () => this.play(1)));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.rounds = feelRounds(this.env.rng);
    this.round = 0;
    this.stage = "choose";
    this.guess = null;
    this.got = [];
    this.seen.clear();
    for (const d of this.pop) d.snap(0);
    this.ringX.snap(0.5);
    this.open.snap(0);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.pi = 0;
    this.pick = null;
    this.locked = false;
    this.setBeat("feel");
    this.prompt.set("Match their move to score.");
    this.note.set("");
    this.enterRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.rounds.forEach((r, i) => {
      this.got[i] = outcome(r, ringSide(r));
    });
    this.round = 4;
    this.enterSee();
    if (beat === "see") return;
    for (const r of this.rounds) this.seen.add(this.key(r));
    this.enterProve();
  }

  private key(r: InfoRound): string {
    const q = quadrant(r.seen, r.known);
    return `${q.x},${q.y}`;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const a = this.pair(0);
    const b = this.pair(1);
    this.guessL.place(a.x, by, a.w);
    this.guessR.place(b.x, by, b.w);
  }

  private sync(): void {
    const choosing = this.beat === "feel" && this.stage === "choose";
    this.guessL.visible = choosing;
    this.guessR.visible = choosing;
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.round >= 4 ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.seen.size === 4;
    this.lock.visible = this.beat === "prove" && !this.locked && this.pick !== null;
  }

  // ---- Feel -------------------------------------------------------------

  private enterRound(): void {
    const r = this.rounds[this.round]!;
    this.stage = "choose";
    this.guess = null;
    this.open.snap(0);
    this.ringX.snap(r.seen ? ringSide(r) : 0.5);
    this.ringX.set(r.seen ? ringSide(r) : 0.5);
    this.prompt.set(this.round === 0 ? "Match their move to score." : "Again. Match their move.");
    this.note.set("");
    this.sync();
  }

  private play(side: Side): void {
    if (this.stage !== "choose") return;
    const r = this.rounds[this.round]!;
    this.guess = side;
    this.stage = "wait";
    this.since = 0;
    this.got[this.round] = outcome(r, side);
    this.ringX.set(ringSide(r));
    this.open.set(1);
    this.cue(this.got[this.round]! > 0 ? "good" : "bad");
    this.sync();
  }

  private revealRound(): void {
    const g = this.got[this.round]!;
    this.stage = "result";
    this.note.set(`You scored ${g}. With everything in view you score ${MATCH_PAYOFF}.`);
    this.announce(`Round ${this.round + 1}. You scored ${g}. With everything in view you score ${MATCH_PAYOFF}.`);
    this.prompt.set(this.round >= 3 ? "Four rounds. Each hid something." : "That is how it was hidden.");
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= 3) {
      this.round = 4;
      this.enterSee();
      return;
    }
    this.round++;
    this.enterRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seen.clear();
    for (const d of this.pop) d.snap(0);
    this.prompt.set("Tap each corner to replay it.");
    this.note.set("Seeing moves and knowing payoffs are two questions.");
    this.sync();
  }

  private inspect(i: number): void {
    const r = this.rounds[i]!;
    const k = this.key(r);
    this.pop[i]!.set(1);
    this.seen.add(k);
    this.cue("good");
    this.note.set(CORNER_NOTE[k]!);
    if (this.seen.size === 4) {
      this.prompt.set("Two questions: see moves, know payoffs.");
      this.note.set("Either one is enough to play well. With neither it is a guess.");
      this.announce("Two separate questions. Perfect information is seeing moves. Complete information is knowing payoffs.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.scenes = proveScenes(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadScene();
  }

  private loadScene(): void {
    this.pick = null;
    this.locked = false;
    this.mark.snap(0);
    this.prompt.set(this.scenes[this.pi]!.name);
    this.note.set(this.pi === 0 ? "Tap the corner this game belongs to." : "Another game. Same two questions.");
    this.sync();
  }

  private lockIn(): void {
    if (!this.pick || this.locked) return;
    const s = this.scenes[this.pi]!;
    const want = quadrant(s.seen, s.known);
    const okX = this.pick.x === want.x;
    const okY = this.pick.y === want.y;
    this.cue(okX && okY ? "good" : "bad");
    if (okX && okY) {
      this.locked = true;
      this.solved++;
      this.mark.set(1);
      this.prompt.set("Right. Two questions, two answers.");
      this.note.set(`${s.seen ? "Moves are seen" : "Moves are hidden"}. ${s.known ? "Payoffs are known" : "Payoffs are not known"}.`);
      this.wait = 1.8;
    } else {
      this.pick = null;
      this.prompt.set("Not quite. Ask the questions one at a time.");
      this.note.set(okX ? `Moves are ${s.seen ? "seen" : "hidden"}, but check the payoffs.` : okY ? `Payoffs fit, but are the moves ${s.seen ? "seen" : "hidden"}?` : "Check both: the moves, then the payoffs.");
    }
    this.sync();
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") {
      for (let i = 0; i < 4; i++) {
        const q = quadrant(this.rounds[i]!.seen, this.rounds[i]!.known);
        if (inside(this.cellBox(q.x, q.y), x, y)) return this.inspect(i);
      }
    } else if (this.beat === "prove" && !this.locked) {
      for (const cx of [0, 1] as const) for (const cy of [0, 1] as const) {
        if (inside(this.cellBox(cx, cy), x, y)) {
          this.pick = { x: cx, y: cy };
          this.sync();
          return;
        }
      }
    } else if (this.beat === "feel" && this.stage === "result") {
      // Taps on the figure do nothing, the button moves on.
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.ringX.step(dt);
    this.open.step(dt);
    this.mark.step(dt);
    for (const d of this.pop) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.8) this.revealRound();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= 3) {
          this.prompt.set("Perfect asks about moves. Complete asks about payoffs.");
          this.note.set("A game can be any of the four corners.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadScene();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  private quad(): { x0: number; y0: number; cw: number; ch: number } {
    const f = this.frame;
    const labelW = 80;
    const headH = 26;
    const cw = Math.floor((f.w - labelW) / 2);
    const ch = Math.floor(clamp((f.h - headH - 8) / 2, 40, 112));
    const x0 = Math.round(f.x + labelW + (f.w - labelW - 2 * cw) / 2);
    const y0 = Math.round(f.top + headH + Math.max(0, f.h - headH - 2 * ch) / 2);
    return { x0, y0, cw, ch };
  }

  private cellBox(x: number, y: number): Box {
    const q = this.quad();
    return { x: q.x0 + x * q.cw, y: q.y0 + y * q.ch, w: q.cw, h: q.ch };
  }

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else this.drawGrid(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const r = this.rounds[Math.min(this.round, 3)]!;
    const bw = (f.w - 12) / 2;
    const ringY = f.top + 16;
    const boxTop = f.top + 42;
    const boxH = Math.max(60, f.bottom - 26 - boxTop);
    const op = this.open.value;
    const side = ringSide(r);
    for (const i of [0, 1] as const) {
      const bx = f.x + i * (bw + 12);
      const hot = this.stage !== "choose" && side === i;
      p.frame(bx, boxTop, bw, boxH, c.ink, (hot ? 0.6 : 0.3) * a);
      p.rect(bx + 1, boxTop + 1, bw - 2, boxH - 2, c.ink, hot ? 0.07 * op : 0);
      const cxm = bx + bw / 2;
      const cym = boxTop + boxH * 0.42;
      const R = Math.min(bw * 0.28, boxH * 0.3);
      const show = r.known ? 1 : op;
      if (show > 0.02) {
        p.ring(cxm, cym, R * Math.sqrt(r.pays[i]! / 9), c.ink, 1.5, show * a);
        p.text(String(r.pays[i]), cxm, boxTop + boxH - 8, { font: Type.mono(11), color: c.fog, align: "center", alpha: show * a });
      }
      if (!r.known) {
        p.dashedRing(cxm, cym, R * 0.7, c.ink, (1 - op) * 0.7 * a);
        p.text("?", cxm, cym, { font: Type.mono(13), color: c.fog, align: "center", base: "middle", alpha: (1 - op) * a });
      }
      if (this.guess === i) p.rect(bx + 6, boxTop + 6, 8, 8, c.ink, 0.9 * a);
    }
    const rx = f.x + bw / 2 + this.ringX.value * (bw + 12);
    const hidden = !r.seen && op < 0.5;
    if (hidden) p.dashedRing(f.x + f.w / 2, ringY, 12, c.ink, 0.7 * a);
    else p.ring(rx, ringY, 12, c.ink, 1.5, a);
    if (this.stage === "result" || this.stage === "wait") {
      const g = this.got[this.round] ?? 0;
      const rad = 9 * Math.sqrt(Math.max(g, 0.01) / MATCH_PAYOFF);
      if (g > 0) p.disc(f.x + 12, ringY, rad, c.ink, 0.92 * op);
      else p.dashedRing(f.x + 12, ringY, 5, c.ink, 0.8 * op);
      p.dashedRing(f.x + 36, ringY, 9, c.ink, 0.8 * op);
    }
    p.text(`move ${r.seen ? "seen" : "hidden"}`, f.x, f.bottom - 4, { font: Type.body(12, 400), color: c.fog, alpha: a });
    p.text(`payoffs ${r.known ? "known" : "unknown"}`, f.x + f.w, f.bottom - 4, { font: Type.body(12, 400), color: c.fog, align: "right", alpha: a });
    for (let i = 0; i < 4; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawGrid(p: Painter, c: Colors, f: Frame): void {
    const q = this.quad();
    for (const x of [0, 1] as const) p.text(COL_NAME[x], q.x0 + (x + 0.5) * q.cw, q.y0 - 12, { font: Type.body(13, 400), color: c.fog, align: "center" });
    for (const y of [0, 1] as const) p.text(ROW_NAME[y], q.x0 - 10, q.y0 + (y + 0.5) * q.ch, { font: Type.body(13, 400), color: c.fog, align: "right", base: "middle" });
    p.frame(q.x0, q.y0, 2 * q.cw, 2 * q.ch, c.ink, 0.3);
    p.rule(q.x0 + q.cw, q.y0, q.x0 + q.cw, q.y0 + 2 * q.ch, c.ink, 0.3);
    p.rule(q.x0, q.y0 + q.ch, q.x0 + 2 * q.cw, q.y0 + q.ch, c.ink, 0.3);
    const pulse = 0.55 + 0.25 * Math.sin(this.time * 2.2);
    if (this.beat === "see") {
      for (let i = 0; i < 4; i++) {
        const rr = this.rounds[i]!;
        const qd = quadrant(rr.seen, rr.known);
        const b = this.cellBox(qd.x, qd.y);
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h * 0.45;
        const t = this.pop[i]!.value;
        if (t < 0.02) {
          p.ring(cx, cy, 8, c.ink, 1.25, pulse);
          continue;
        }
        const g = this.got[i] ?? 0;
        if (g > 0) p.disc(cx, cy, 20 * Math.sqrt(g / MATCH_PAYOFF) * t, c.ink, 0.92);
        else p.dashedRing(cx, cy, 12 * t, c.ink, 0.9);
        p.text(String(g), cx, b.y + b.h - 8, { font: Type.mono(11), color: c.fog, align: "center", alpha: t });
      }
    } else {
      const sel = this.pick;
      if (sel) {
        const b = this.cellBox(sel.x, sel.y);
        p.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, c.ink, 0.1);
        p.disc(b.x + b.w / 2, b.y + b.h / 2, 9, c.ink, 0.95);
      }
      const s = this.scenes[Math.min(this.pi, this.scenes.length - 1)];
      if (s && this.mark.value > 0.02) {
        const want = quadrant(s.seen, s.known);
        const b = this.cellBox(want.x, want.y);
        p.ring(b.x + b.w / 2, b.y + b.h / 2, 18, c.ink, 1.5, this.mark.value);
      }
    }
    const n = this.beat === "see" ? 4 : 3;
    const done = this.beat === "see" ? this.seen.size : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done);
  }
}
