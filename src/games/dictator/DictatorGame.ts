import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Slider, drawTicks, fmt } from "../shared/kit";
import { inside } from "../shared/MatrixView";
import { POT, Giver, Responder, provePairs, type Pair } from "./model";

type Stage = "dictate" | "dictated" | "propose" | "proposed";

/**
 * Feel: split 10 coins with a stranger who cannot answer, then split another 10 with one who can refuse.
 * See: your two offers side by side. What you gave when nobody could refuse is your gift, the rest is fear.
 * Prove: two new pairs of people. Tap the one who is kinder, using only what shows generosity.
 */
export class DictatorGame extends Game {
  readonly slug = "dictator";
  private stage: Stage = "dictate";
  private readonly slider = new Slider();
  private d = 0;
  private u = 0;
  private minimum = 3;
  private since = 0;
  private waiting = false;
  private readonly keepV = new Damped(5, 0.3);
  private readonly giveV = new Damped(5, 0.3);
  private readonly altV = new Damped(0, 0.4);

  private seeStep = 0;
  private readonly rowB = new Damped(0, 0.5);
  private readonly split = new Damped(0, 0.5);

  private pairs: Pair[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: "a" | "b" | null = null;
  private armed: "a" | "b" | null = null;
  private readonly crown = new Damped(0, 0.4);

  private readonly give = this.add(new CanvasButton("Give", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.afterDictator(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.stage = "dictate";
    this.slider.value = 0.3;
    this.d = 0;
    this.u = 0;
    this.minimum = this.env.rng.int(2, 4);
    this.waiting = false;
    this.keepV.snap(7);
    this.giveV.snap(3);
    this.altV.snap(0);
    this.seeStep = 0;
    this.rowB.snap(0);
    this.split.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("Split 10 coins. They cannot answer back.");
    this.note.set("Drag to choose how many they get.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.d = 2;
    this.u = 4;
    this.enterSee();
    if (beat === "see") {
      this.seeStep = 0;
      this.advance();
      this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" || this.beat === "see" ? 44 : 64;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.give, this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.give.visible = feel && !this.waiting && (this.stage === "dictate" || this.stage === "propose");
    this.next.visible = feel && this.stage === "dictated";
    this.toSee.visible = feel && this.stage === "proposed";
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (this.stage === "dictate" || this.stage === "propose") {
        if (!this.waiting && y >= this.frame.top && y <= this.frame.bottom) {
          this.slider.dragging = true;
          this.drag(x);
        }
      }
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      if (inside(this.pair(0), x, y)) this.armed = "a";
      else if (inside(this.pair(1), x, y)) this.armed = "b";
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.slider.dragging) this.drag(x);
  }

  protected override onUp(x: number, y: number): void {
    this.slider.dragging = false;
    const m = this.armed;
    this.armed = null;
    if (m && this.beat === "prove" && !this.locked && inside(this.pair(m === "a" ? 0 : 1), x, y)) this.answer(m);
  }

  private drag(x: number): void {
    this.slider.setFromX(x, 0.1);
    this.preview();
  }

  private offer(): number {
    return Math.round(this.slider.value * POT);
  }

  private preview(): void {
    if (this.waiting) return;
    this.keepV.set(POT - this.offer());
    this.giveV.set(this.offer());
  }

  // ---- Feel -------------------------------------------------------------

  private commit(): void {
    const x = this.offer();
    this.waiting = true;
    this.since = 0;
    if (this.stage === "dictate") {
      this.d = x;
      this.note.set("");
      this.prompt.set("It is done. They had no say.");
      this.altV.set(POT);
      this.keepV.set(POT - x);
      this.giveV.set(x);
      this.cue("good");
    } else {
      this.u = x;
      this.prompt.set("They are deciding.");
      this.note.set("");
    }
    this.sync();
  }

  private finishDictator(): void {
    this.waiting = false;
    this.stage = "dictated";
    this.note.set(`You kept ${fmt(POT - this.d)}. Keeping everything would have been ${POT}.`);
    this.announce(`Dictator game. You gave ${this.d} and kept ${POT - this.d}.`);
    this.sync();
  }

  private afterDictator(): void {
    this.stage = "propose";
    this.slider.value = Math.max(0.2, this.slider.value);
    this.altV.snap(0);
    this.waiting = false;
    this.keepV.snap(POT - this.offer());
    this.giveV.snap(this.offer());
    this.prompt.set("Now they can refuse. A refusal leaves both with 0.");
    this.note.set("Drag to choose their share.");
    this.sync();
  }

  private finishProposal(): void {
    const ok = new Responder(this.minimum).accepts(this.u);
    this.waiting = false;
    this.stage = "proposed";
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.keepV.set(POT - this.u);
      this.giveV.set(this.u);
      this.altV.set(0);
      this.prompt.set("They accepted. Two offers to compare.");
      this.note.set(`You kept ${fmt(POT - this.u)}. Their minimum was ${this.minimum}.`);
    } else {
      this.altV.set(POT - this.u);
      this.keepV.set(0);
      this.giveV.set(0);
      this.prompt.set("They refused. Two offers to compare.");
      this.note.set(`Both got 0. Their minimum was ${this.minimum}. You would have kept ${fmt(POT - this.u)}.`);
    }
    this.announce(`Ultimatum game. You offered ${this.u}. They ${ok ? "accepted" : "refused"}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.rowB.snap(0);
    this.split.snap(0);
    this.prompt.set(`Nobody could refuse. You gave ${this.d}.`);
    this.note.set("Tap to continue.");
    this.sync();
  }

  private advance(): void {
    if (this.seeStep >= 2) return;
    this.seeStep++;
    const g = new Giver(this.d, this.u);
    if (this.seeStep === 1) {
      this.rowB.set(1);
      this.prompt.set(`They could refuse. You gave ${this.u}.`);
      this.note.set("Same person, same coins. Tap again.");
    } else {
      this.split.set(1);
      this.prompt.set(g.fear > 0 ? `${g.generosity} is gift. ${g.fear} is fear of refusal.` : "All of it is gift. Refusal added nothing.");
      this.note.set(g.fear > 0 ? "The no say game shows what you give when only you decide." : "Giving the same when they cannot refuse is pure generosity.");
      this.announce(`Gift ${g.generosity}. Fear of refusal ${g.fear}.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pairs = provePairs(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPair();
  }

  private loadPair(): void {
    this.locked = false;
    this.wrong = null;
    this.crown.snap(0);
    this.prompt.set(this.pi === 0 ? "Two people, two games. Who is kinder?" : "Two more. Who is kinder?");
    this.note.set("Each gave in both games. Choose with the game that shows kindness.");
    this.sync();
  }

  private answer(pick: "a" | "b"): void {
    const pr = this.pairs[this.pi]!;
    const win = pr.kinder === "a" ? pr.a : pr.b;
    const lose = pr.kinder === "a" ? pr.b : pr.a;
    if (pick === pr.kinder) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      this.crown.set(1);
      this.prompt.set("Right. Kindness is what they give with no say.");
      this.note.set(`${win.dictator} beats ${lose.dictator}. The other gave more only when refusal was possible.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.wrong = pick;
      this.prompt.set("Not quite. Look at the no say row.");
      this.note.set(`With no say, the other gave ${win.dictator} and this one gave ${lose.dictator}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.keepV.step(dt);
    this.giveV.step(dt);
    this.altV.step(dt);
    this.rowB.step(dt);
    this.split.step(dt);
    this.crown.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.stage === "dictate" && this.since > 1.1) this.finishDictator();
      else if (this.stage === "propose" && this.since > 1.1) this.finishProposal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.pairs.length) {
          this.prompt.set("A gift is what you give when nobody can make you.");
          this.note.set("Offers made under threat measure fear, not kindness.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadPair();
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
    const R = clamp((f.h - 112) / 2, 18, 54);
    const cy = f.top + R + 4;
    const off = Math.min(84, f.w / 2 - R - 36);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / POT);
    const idle = this.waiting && this.since < 1.1 ? 0.55 + 0.45 * Math.sin(this.time * 9) : 1;
    if (this.altV.value > 0.05) p.dashedRing(xl, cy, r(this.altV.value), c.ink, 0.8);
    if (this.keepV.value > 0.05) p.disc(xl, cy, r(this.keepV.value), c.ink, 0.95 * idle);
    if (this.giveV.value > 0.05) p.ring(xr, cy, r(this.giveV.value), c.ink, 1.5, idle);
    const ly = cy + R + 20;
    const keepN = this.waiting || this.stage === "dictated" || this.stage === "proposed" ? this.keepV.target : POT - this.offer();
    const giveN = this.waiting || this.stage === "dictated" || this.stage === "proposed" ? this.giveV.target : this.offer();
    p.text(`You keep ${fmt(keepN)}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`They get ${fmt(giveN)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    const live = (this.stage === "dictate" || this.stage === "propose") && !this.waiting;
    if (live) {
      const ty = Math.min(f.bottom - 28, ly + 56);
      this.slider.place(f.x + 24, f.x + f.w - 24, ty);
      this.slider.draw(p, c);
      for (const v of [0, 5, 10]) p.text(String(v), this.slider.at(v / 10), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    drawTicks(p, c, f, this.cx, 2, this.stage === "dictate" || this.stage === "dictated" ? (this.stage === "dictated" ? 1 : 0) : this.stage === "proposed" ? 2 : 1, this.stage === "dictate" || this.stage === "dictated" ? 0 : 1);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const Rs = clamp((f.h - 40) / 4, 12, 40);
    const xr = f.x + f.w * 0.62;
    const r = (v: number) => Rs * Math.sqrt(Math.max(0, v) / POT);
    const y1 = f.top + Rs + 6;
    const y2 = f.top + 3 * Rs + 30;
    const font = Type.body(13, 400);
    p.text("no say", f.x, y1, { font, color: c.fog, base: "middle" });
    p.ring(xr, y1, r(this.d), c.ink, 1.5);
    p.text(fmt(this.d), xr + Rs + 14, y1, { font: Type.mono(12), color: c.ink, base: "middle" });
    const b = this.rowB.value;
    if (b > 0.01) {
      p.text("could refuse", f.x, y2, { font, color: c.fog, base: "middle", alpha: b });
      p.ring(xr, y2, r(this.u) * b, c.ink, 1.5, b);
      const s = this.split.value;
      const g = new Giver(this.d, this.u);
      if (s > 0.01 && g.fear > 0) p.dashedRing(xr, y2, r(this.d), c.ink, s);
      if (s > 0.01) {
        p.text(g.fear > 0 ? `gift ${fmt(g.generosity)}` : `all gift`, xr + Rs + 14, y2 - 9, { font: Type.mono(11), color: c.ink, base: "middle", alpha: s });
        if (g.fear > 0) p.text(`fear ${fmt(g.fear)}`, xr + Rs + 14, y2 + 9, { font: Type.mono(11), color: c.fog, base: "middle", alpha: s });
      } else p.text(fmt(this.u), xr + Rs + 14, y2, { font: Type.mono(12), color: c.ink, base: "middle", alpha: b });
    }
    drawTicks(p, c, f, this.cx, 3, this.seeStep + 1, this.seeStep);
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const pr = this.pairs[Math.min(this.pi, this.pairs.length - 1)]!;
    const Rv = clamp((f.h - 76) / 4, 12, 36);
    const left = f.x + 76;
    const xA = left + (f.w - 76) * 0.25;
    const xB = left + (f.w - 76) * 0.75;
    const r = (v: number) => Rv * Math.sqrt(Math.max(0, v) / 7);
    const hy = f.top + 12;
    const row1 = f.top + 30 + Rv;
    const n1 = row1 + Rv + 14;
    const row2 = n1 + 12 + Rv;
    const n2 = row2 + Rv + 14;
    const font = Type.body(12, 400);
    p.text("could refuse", f.x, row1, { font, color: c.fog, base: "middle" });
    p.text("no say", f.x, row2, { font, color: c.fog, base: "middle" });
    const k = this.crown.value;
    for (const [id, x, g] of [["a", xA, pr.a], ["b", xB, pr.b]] as const) {
      const dim = this.wrong === id ? 0.35 : this.locked && pr.kinder !== id ? 0.35 : 1;
      p.text(id.toUpperCase(), x, hy, { font: Type.body(14, 400), color: c.ink, align: "center", base: "middle", alpha: dim });
      p.ring(x, row1, r(g.ultimatum), c.ink, 1.5, dim);
      p.text(fmt(g.ultimatum), x, n1, { font: Type.mono(11), color: c.fog, align: "center", alpha: dim });
      p.ring(x, row2, r(g.dictator), c.ink, 1.5, dim);
      p.text(fmt(g.dictator), x, n2, { font: Type.mono(11), color: c.fog, align: "center", alpha: dim });
      if (pr.kinder === id && k > 0.01) p.ring(x, hy, 11, c.ink, 1.25, k);
    }
    for (const i of [0, 1] as const) {
      const z = this.pair(i);
      const id = i === 0 ? "a" : "b";
      const al = this.wrong === id ? 0.35 : this.locked && pr.kinder !== id ? 0.3 : 1;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armed === id ? 0.08 : 0);
      p.text(`${id.toUpperCase()} is kinder`, z.x + z.w / 2, z.y + z.h / 2, { font: Type.body(15, 400), color: c.ink, align: "center", base: "middle", alpha: al });
    }
    drawTicks(p, c, f, this.cx, this.pairs.length, this.solved, this.pi);
  }
}
