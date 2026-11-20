import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_OTHERS, FEEL_PASTURE, PROVE_PASTURES, type Pasture } from "./model";

type Take = 1 | 2;

/**
 * Feel: five herders share a field. Put out one sheep or two, and see what the other choice would have paid.
 * See: five columns, by how many of the others put out two. A second sheep wins in every one, and everyone at two loses.
 * Prove: three new fields. Is it a tragedy?
 */
export class TragedyCommonsGame extends Game {
  readonly slug = "tragedy-commons";
  private others: number[] = [];
  private mine: Take[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private armed: Take | null = null;
  private readonly youR = new Damped(0, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly herd = new Damped(0, 0.4);

  private shown = 0;
  private readonly cols: Damped[] = [0, 1, 2, 3, 4].map(() => new Damped(0, 0.45));
  private readonly trap = new Damped(0, 0.6);

  private fields: Pasture[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: boolean | null = null;
  private armedAns: boolean | null = null;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  private get g(): Pasture {
    return FEEL_PASTURE;
  }

  begin(): void {
    this.others = this.env.rng.shuffle(FEEL_OTHERS);
    this.mine = [];
    this.round = 0;
    this.stage = "choose";
    this.youR.snap(0);
    this.altR.snap(0);
    this.herd.snap(0);
    this.shown = 0;
    this.cols.forEach((d) => d.snap(0));
    this.trap.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Five herders share one field. One sheep or two?");
    this.note.set("A sheep is worth less when the field is crowded.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.mine = [2, 1, 2, 2, 1];
    this.round = 5;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 6; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 5 && this.stage === "result";
    this.toProve.visible = this.beat === "see" && this.shown >= 6;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "choose") {
        if (inside(this.pair(0), x, y)) this.armed = 1;
        else if (inside(this.pair(1), x, y)) this.armed = 2;
      } else if (this.stage === "result" && this.round < 5) this.nextRound();
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      if (inside(this.pair(0), x, y)) this.armedAns = true;
      else if (inside(this.pair(1), x, y)) this.armedAns = false;
    }
  }

  protected override onUp(x: number, y: number): void {
    const t = this.armed;
    this.armed = null;
    if (t && this.beat === "feel" && this.stage === "choose" && inside(this.pair(t === 1 ? 0 : 1), x, y)) this.play(t);
    const a = this.armedAns;
    this.armedAns = null;
    if (a !== null && this.beat === "prove" && !this.locked && inside(this.pair(a ? 0 : 1), x, y)) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private play(t: Take): void {
    this.mine.push(t);
    this.stage = "wait";
    this.since = 0;
    this.herd.snap(0);
    this.prompt.set(this.round === 0 ? "The others are putting out their sheep." : "Waiting for the others.");
    this.note.set("");
    this.sync();
  }

  private reveal(): void {
    const me = this.mine[this.round]!;
    const k = this.others[this.round]!;
    const alt: Take = me === 1 ? 2 : 1;
    const got = this.g.payoff(me, k);
    const other = this.g.payoff(alt, k);
    this.youR.set(this.rad(got));
    this.altR.set(this.rad(other));
    this.herd.set(1);
    this.cue(got >= other ? "good" : "bad");
    this.note.set(`${k} of 4 others put out two. You got ${fmt(got)}. ${alt === 1 ? "One" : "Two"} sheep would have paid ${fmt(other)}.`);
    this.announce(`Round ${this.round + 1}. ${k} of the 4 others put out two sheep. You got ${fmt(got)}. ${alt === 1 ? "One" : "Two"} sheep would have paid ${fmt(other)}.`);
    this.round++;
    this.stage = "result";
    this.prompt.set(this.round >= 5 ? "Five rounds. Did two always pay?" : "Tap for the next round.");
    this.sync();
  }

  private nextRound(): void {
    this.stage = "choose";
    this.youR.set(0);
    this.altR.set(0);
    this.herd.snap(0);
    this.prompt.set("Same field. One sheep or two?");
    this.note.set("A sheep is worth less when the field is crowded.");
    this.sync();
  }

  private rad(v: number): number {
    return v <= 0 ? 0 : 50 * Math.sqrt(v / 7);
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.shown = 0;
    this.cols.forEach((d) => d.snap(0));
    this.trap.snap(0);
    this.prompt.set("Tap to try each case. How many of the others put out two?");
    this.note.set("Columns: others at two. Ring: one sheep. Disc: two.");
    this.sync();
  }

  private advance(): void {
    if (this.shown >= 6) return;
    if (this.shown < 5) {
      this.cols[this.shown]!.set(1);
      this.shown++;
      this.note.set(`${this.shown} of 5 shown. Columns: others at two. Ring: one sheep. Disc: two.`);
      if (this.shown === 5) {
        this.prompt.set("Two sheep win in every case.");
        this.note.set("Tap once more.");
      }
    } else {
      this.shown = 6;
      this.trap.set(1);
      this.prompt.set("Yet everyone at two does worse than everyone at one.");
      this.note.set(`All at one: ${fmt(this.g.allOne)} each. All at two: ${fmt(this.g.allTwo)} each.`);
      this.announce(`All at one sheep pays ${fmt(this.g.allOne)} each. All at two pays ${fmt(this.g.allTwo)} each.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.fields = this.env.rng.shuffle(PROVE_PASTURES);
    this.pi = 0;
    this.solved = 0;
    this.loadField();
  }

  private loadField(): void {
    this.locked = false;
    this.wrong = null;
    this.prompt.set(this.pi === 0 ? "A new field. Is it a tragedy?" : "Another field. Is it a tragedy?");
    this.note.set("Two tests: two beats one for each herder, and all at two loses to all at one.");
    this.sync();
  }

  private answer(says: boolean): void {
    const f = this.fields[this.pi]!;
    if (says === f.tragic) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      this.prompt.set(f.tragic ? "Right. Both tests fail the herders." : "Right. One test fails.");
      this.note.set(this.why(f));
      this.wait = 2.4;
    } else {
      this.cue("bad");
      this.wrong = says;
      this.prompt.set("Not quite. Run both tests.");
      this.note.set(this.hint(f));
    }
    this.sync();
  }

  private why(f: Pasture): string {
    if (f.tragic) return `Alone at two you get ${fmt(f.alone)} against ${fmt(f.allOne)}, yet all at two pays only ${fmt(f.allTwo)}.`;
    if (!f.twoDominates) return `A second sheep alone pays ${fmt(f.alone)}, less than ${fmt(f.allOne)}. Nobody is tempted.`;
    return `All at two pays ${fmt(f.allTwo)}, more than ${fmt(f.allOne)}. The field can take it.`;
  }

  private hint(f: Pasture): string {
    return f.tragic ? `Alone at two pays ${fmt(f.alone)}, more than ${fmt(f.allOne)}. All at two pays ${fmt(f.allTwo)}.` : `Compare ${fmt(f.alone)}, ${fmt(f.allOne)} and ${fmt(f.allTwo)}.`;
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.youR.step(dt);
    this.altR.step(dt);
    this.herd.step(dt);
    this.trap.step(dt);
    for (const d of this.cols) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.fields.length) {
          this.prompt.set("Each gains by taking more. All lose when all do.");
          this.note.set("That gap between one and all is the tragedy.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadField();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProve(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const s = clamp((f.h - 60) / 150, 0.6, 1.2);
    const slot = f.w / 5;
    const hy = f.top + 20 * s + 6;
    const done = this.stage === "result";
    const shown = done ? this.round - 1 : this.round;
    const k = this.others[Math.min(shown, 4)]!;
    const takers = done || this.stage === "wait" ? k : -1;
    for (let i = 0; i < 5; i++) {
      const x = f.x + (i + 0.5) * slot;
      if (i === 0) p.disc(x, hy, 11 * s, c.ink, 0.92);
      else p.ring(x, hy, 11 * s, c.ink, 1.5);
      if (this.herd.value > 0.05 || this.stage === "wait") {
        const takes = i === 0 ? this.mine[shown] ?? 1 : i <= takers ? 2 : 1;
        const a = this.stage === "wait" ? 0.3 : this.herd.value;
        for (let j = 0; j < takes; j++) p.disc(x, hy + 11 * s + 11 + j * 9, 3, c.ink, a);
      }
    }
    p.text("You", f.x + 0.5 * slot, hy - 11 * s - 8, { font: Type.body(11, 400), color: c.fog, align: "center" });
    p.text("Others", f.x + 3 * slot, hy - 11 * s - 8, { font: Type.body(11, 400), color: c.fog, align: "center" });
    const R = 50 * s;
    const cy = hy + 11 * s + 36 + R;
    if (this.altR.value > 0.5) p.dashedRing(this.cx, cy, this.altR.value * s, c.ink, 0.8);
    if (this.youR.value > 0.5) p.disc(this.cx, cy, this.youR.value * s, c.ink, 0.95);
    if (done) p.text(`You got ${fmt(this.g.payoff(this.mine[shown]!, k))}`, this.cx, cy + R + 20, { font: Type.body(13, 400), color: c.fog, align: "center" });
    for (const i of [0, 1] as const) {
      if (this.round >= 5) break;
      const t: Take = i === 0 ? 1 : 2;
      const live = this.stage === "choose";
      const chosen = this.mine[shown] === t && this.stage !== "choose";
      const al = live ? 1 : chosen ? 0.9 : this.round >= 5 ? 0 : 0.3;
      drawChoice(p, c, this.pair(i), { label: t === 1 ? "One sheep" : "Two sheep", sub: t === 1 ? "share the field" : "take more", r: 10 + 8 * t, alpha: al, armed: this.armed === t });
    }
    drawTicks(p, c, f, this.cx, 5, this.round, this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const slot = f.w / 5;
    const top = Math.max(...[0, 1, 2, 3, 4].map((k) => this.g.payoff(2, k)));
    const R = clamp(Math.min(slot * 0.42, (f.h - 90) / 2.4), 12, 40);
    const rr = (v: number) => R * Math.sqrt(Math.max(0, v) / top);
    const yR = f.top + 26 + R;
    const yD = yR + R + 14 + R;
    const yn = yD + R + 16;
    for (let k = 0; k < 5; k++) {
      const x = f.x + (k + 0.5) * slot;
      const a = this.cols[k]!.value;
      p.text(String(k), x, f.top + 10, { font: Type.mono(11), color: c.fog, align: "center" });
      if (a < 0.01) {
        p.ring(x, (yR + yD) / 2, 5, c.ink, 1.25, 0.3 + 0.2 * Math.sin(this.time * 4 + k));
        continue;
      }
      p.ring(x, yR, rr(this.g.payoff(1, k)) * a, c.ink, 1.5, a);
      p.disc(x, yD, rr(this.g.payoff(2, k)) * a, c.ink, 0.92 * a);
      p.text(`${fmt(this.g.payoff(1, k))} | ${fmt(this.g.payoff(2, k))}`, x, yn, { font: Type.mono(10), color: c.fog, align: "center", alpha: a });
    }
    const t = this.trap.value;
    if (t > 0.01) {
      const x0 = f.x + 0.5 * slot;
      const x4 = f.x + 4.5 * slot;
      p.dashedRing(x4, yD, rr(this.g.allOne), c.ink, t);
      p.dashedRing(x0, yR, rr(this.g.allTwo), c.ink, t);
    }
    drawTicks(p, c, f, this.cx, 6, this.shown, Math.min(this.shown, 5));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const fd = this.fields[Math.min(this.pi, this.fields.length - 1)]!;
    const vals = [fd.allOne, fd.alone, fd.allTwo];
    const top = Math.max(...vals);
    const slot = f.w / 3;
    const R = clamp(Math.min(slot * 0.4, (f.h - 70) / 2), 14, 50);
    const rr = (v: number) => R * Math.sqrt(Math.max(0, v) / top);
    const cy = f.top + 18 + R;
    const labels = ["all put out one", "you alone two", "all put out two"];
    for (let i = 0; i < 3; i++) {
      const x = f.x + (i + 0.5) * slot;
      if (i === 1) p.disc(x, cy, rr(vals[i]!), c.ink, 0.92);
      else p.ring(x, cy, rr(vals[i]!), c.ink, 1.5);
      p.text(fmt(vals[i]!), x, cy + R + 16, { font: Type.mono(12), color: c.ink, align: "center" });
      p.text(labels[i]!, x, cy + R + 34, { font: Type.body(11, 400), color: c.fog, align: "center" });
    }
    for (const i of [0, 1] as const) {
      const yes = i === 0;
      const al = this.wrong === yes ? 0.35 : this.locked && yes !== fd.tragic ? 0.3 : 1;
      const z = this.pair(i);
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armedAns === yes ? 0.08 : 0);
      p.text(yes ? "Tragedy" : "No tragedy", z.x + z.w / 2, z.y + z.h / 2, { font: Type.body(15, 400), color: c.ink, align: "center", base: "middle", alpha: al });
    }
    drawTicks(p, c, f, this.cx, this.fields.length, this.solved, this.pi);
  }
}
