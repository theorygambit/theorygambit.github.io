import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { FEEL_GAME, generate, playFeel, trustingTake, type Centipede } from "./model";

interface Decision {
  node: number;
  took: boolean;
}

/**
 * Feel: play against a partner who passes at node 2 and takes at node 4.
 * See: tap from the last node back. Each mover takes, and the later nodes fade.
 * Prove: new payoffs. Work back from the end and tap the node where logic ends the game.
 */
export class CentipedeGame extends Game {
  readonly slug = "centipede";
  private g: Centipede = FEEL_GAME;
  private at = 0;
  private stage: "you" | "wait" | "over" = "you";
  private end: number | null = null;
  private decisions: Decision[] = [];
  private plays = 0;
  private since = 0;
  private readonly intro = new Damped(0, 0.7);
  private readonly mark = new Damped(0, 0.5);

  private resolved = 0;
  private readonly fade: Damped[] = Array.from({ length: 5 }, () => new Damped(1, 0.5));

  private puzzles: Centipede[] = [];
  private pi = 0;
  private solved = 0;
  private done = false;
  private wait = 0;
  private answer = 0;

  private readonly take = this.add(new CanvasButton("Take", () => this.decide(true)));
  private readonly pass = this.add(new CanvasButton("Pass", () => this.decide(false), "primary"));
  private readonly again = this.add(new CanvasButton("Again", () => this.restart()));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly node = [1, 2, 3, 4].map((n) => this.add(new CanvasButton(String(n), () => this.guess(n))));

  begin(): void {
    this.g = FEEL_GAME;
    this.plays = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.restart();
  }

  private restart(): void {
    this.at = 0;
    this.stage = "you";
    this.end = null;
    this.decisions = [];
    this.mark.snap(0);
    this.prompt.set(this.plays === 0 ? "Your node. Take, or pass and let it grow." : "Again. Take, or pass?");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.plays = 1;
    this.enterSee();
    if (beat === "see") return;
    this.resolved = 4;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    const a = this.pair(0);
    const b = this.pair(1);
    this.take.place(a.x, by, a.w);
    this.pass.place(b.x, by, b.w);
    this.again.place(a.x, by, a.w);
    this.toSee.place(b.x, by, b.w);
    this.toProve.place(this.cx - 80, by, 160);
    const f = this.frame;
    const gap = 8;
    const w = (f.w - gap * 3) / 4;
    this.node.forEach((n, i) => n.place(f.x + i * (w + gap), by, w));
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.take.visible = feel && this.stage === "you";
    this.pass.visible = feel && this.stage === "you";
    this.again.visible = feel && this.stage === "over";
    this.toSee.visible = feel && this.stage === "over";
    this.toProve.visible = this.beat === "see" && this.resolved >= 4;
    for (const n of this.node) n.visible = this.beat === "prove" && !this.done;
  }

  // ---- Feel -------------------------------------------------------------

  private decide(takes: boolean): void {
    if (this.stage !== "you") return;
    this.decisions.push({ node: this.at, took: takes });
    this.cue(takes ? "good" : "bad");
    if (takes) return this.finishGame(this.at);
    this.at++;
    this.stage = "wait";
    this.since = 0;
    this.prompt.set("They think.");
    this.note.set("");
    this.sync();
  }

  private theirMove(): void {
    if (trustingTake(this.at)) return this.finishGame(this.at);
    this.at++;
    if (this.at >= this.g.nodes) return this.finishGame(null);
    this.stage = "you";
    this.prompt.set("They passed. Take, or pass?");
    this.sync();
  }

  private finishGame(node: number | null): void {
    this.end = node;
    this.at = node ?? this.g.nodes;
    this.stage = "over";
    this.plays++;
    const you = this.payAt(node)[0];
    const last = this.decisions[this.decisions.length - 1]!;
    const alt = last.took ? (last.node === 0 ? Math.max(playFeel(false, true).pay[0], playFeel(false, false).pay[0]) : playFeel(false, false).pay[0]) : this.g.takes[last.node]![0];
    const msg = `You got ${you}. The other choice at node ${last.node + 1} paid ${alt}.`;
    const head = node === null ? "Everyone passed to the end." : node === 0 ? "You took at once." : `The game ended at node ${node + 1}.`;
    this.prompt.set(head);
    this.note.set(msg);
    this.mark.set(1);
    this.announce(`${head} ${msg}`);
    this.sync();
  }

  private payAt(node: number | null): readonly [number, number] {
    return node === null ? this.g.finalPay : this.g.takes[node]!;
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_GAME;
    this.resolved = 0;
    this.end = null;
    for (const d of this.fade) d.snap(1);
    this.mark.snap(0);
    this.prompt.set("Start at the last node. Tap.");
    this.note.set("What would the last mover do?");
    this.sync();
  }

  protected override onDown(): void {
    if (this.beat === "see") this.unravel();
  }

  private unravel(): void {
    if (this.resolved >= 4) return;
    const k = 3 - this.resolved;
    this.resolved++;
    this.cue("good");
    const cmp = this.g.compare(k);
    const who = this.g.mover(k) === 0 ? "You" : "They";
    this.mark.snap(0);
    this.mark.set(1);
    for (let i = k + 1; i <= 4; i++) this.fade[i]!.set(0.22);
    this.note.set(`${who} take at ${k + 1}: ${cmp.take} beats ${cmp.pass}.`);
    if (this.resolved >= 4) {
      this.prompt.set("Logic ends it at the first node.");
      this.note.set(`You get ${this.g.takes[0]![0]}. Passing all the way pays ${this.g.finalPay[0]}.`);
      this.announce(`Working back, every mover takes. The game ends at node 1 and you get ${this.g.takes[0]![0]}, though passing to the end pays ${this.g.finalPay[0]}.`);
    } else this.prompt.set(this.resolved === 1 ? "They take. Now the node before." : "Take again. Go back one more.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    const later = this.env.rng.pick([2, 3, 4]);
    const wants = this.env.rng.shuffle([1, later]);
    this.puzzles = wants.map((w) => generate(this.env.rng, w));
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.g = this.puzzles[this.pi]!;
    this.answer = this.g.logicalEnd ?? 0;
    this.done = false;
    this.mark.snap(0);
    for (const d of this.fade) d.snap(1);
    this.prompt.set(this.pi === 0 ? "New payoffs. Where does logic end it?" : "Different payoffs. Where does it end?");
    this.note.set("Work back from the last node.");
    this.sync();
  }

  private guess(n: number): void {
    if (this.done) return;
    if (n === this.answer) {
      this.cue("good");
      this.done = true;
      this.solved++;
      this.mark.set(1);
      const cmp = this.g.compare(n - 1);
      this.prompt.set(`Right. It ends at node ${n}.`);
      this.note.set(`${this.g.mover(n - 1) === 0 ? "You" : "They"} take: ${cmp.take} beats ${cmp.pass}.`);
      for (let i = n; i <= 4; i++) this.fade[i]!.set(0.22);
      this.wait = 2;
    } else {
      this.cue("bad");
      const cmp = this.g.compare(n - 1);
      if (n < this.answer) {
        this.prompt.set(`Not quite. Node ${n} would pass.`);
        this.note.set(`Passing leads to ${cmp.pass}, more than taking ${cmp.take}.`);
      } else {
        this.prompt.set("Not quite. An earlier node takes first.");
        this.note.set(`At node ${n} taking pays ${cmp.take}. Work back and see who stops sooner.`);
      }
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.mark.step(dt);
    for (const d of this.fade) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.8) this.theirMove();
    }
    if (this.beat === "prove" && this.done && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Solve from the end, node by node.");
          this.note.set("Logic ends early. Trust can pay more.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadPuzzle();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const g = this.g;
    const slots = g.nodes + 1;
    const step = f.w / slots;
    const R = clamp(Math.min(step * 0.19, f.h * 0.11), 7, 14);
    let maxV = 1;
    for (const t of [...g.takes, g.finalPay]) maxV = Math.max(maxV, t[0], t[1]);
    const block = 14 + 20 + 2 * R + 20;
    const y1 = f.top + Math.max(14, (f.h - block) / 2) + 18;
    const y2 = y1 + 20 + R;
    const numY = y2 + R + 13;
    p.rule(f.x + step * 0.5, y1, f.x + step * (slots - 0.5), y1, c.ink, 0.3 * a);
    const frameAt = (i: number, alpha: number) => {
      const x = f.x + step * (i + 0.5);
      p.frame(x - step / 2 + 3, y2 - R - 6, step - 6, numY + 7 - (y2 - R - 6), c.ink, alpha);
    };
    for (let i = 0; i < slots; i++) {
      const x = f.x + step * (i + 0.5);
      const al = a * this.fade[i]!.value;
      const pay = i < g.nodes ? g.takes[i]! : g.finalPay;
      if (i < g.nodes) {
        p.text(String(i + 1), x, y1 - 18, { font: Type.mono(10), color: c.ash, align: "center", alpha: al });
        if (g.mover(i) === 0) p.disc(x, y1, 7, c.ink, 0.92 * al);
        else p.ring(x, y1, 7, c.ink, 1.5, al);
      } else p.text("end", x, y1 - 18, { font: Type.mono(10), color: c.ash, align: "center", alpha: al });
      const xl = x - step * 0.25;
      const xr = x + step * 0.25;
      p.disc(xl, y2, R * Math.sqrt(pay[0] / maxV), c.ink, 0.92 * al);
      p.ring(xr, y2, R * Math.sqrt(pay[1] / maxV), c.ink, 1.5, al);
      p.text(String(pay[0]), xl, numY, { font: Type.mono(10), color: c.fog, align: "center", alpha: al });
      p.text(String(pay[1]), xr, numY, { font: Type.mono(10), color: c.fog, align: "center", alpha: al });
    }
    const m = this.mark.value;
    if (this.beat === "feel") {
      if (this.stage !== "over") {
        const x = f.x + step * (this.at + 0.5);
        p.ring(x, y1, 12, c.ink, 1, 0.5 + 0.4 * Math.sin(this.time * 3));
      } else if (m > 0.02) frameAt(this.end ?? slots - 1, m);
      for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, this.plays > i, this.plays === i);
    } else if (this.beat === "see") {
      if (this.resolved > 0 && m > 0.02) frameAt(3 - (this.resolved - 1), m);
      for (let i = 0; i < 4; i++) Glyph.step(p, c, this.cx - 30 + i * 20, f.tickY, i < this.resolved, i === this.resolved);
    } else {
      if (this.done && m > 0.02) frameAt(this.answer - 1, m);
      for (let i = 0; i < this.puzzles.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
    }
  }
}
