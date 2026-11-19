import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { Slider } from "../shared/Slider";
import { fmt } from "../shared/fmt";
import { FEEL_GAME, PROVE_POOL, partnerClaims, type TravelCase, type Travelers } from "./model";

const ROUNDS = 3;

/**
 * Feel: three rounds of naming a claim. Each shows what one lower would have paid.
 * See: drag the partner's claim down. Your best reply is one below, and the steps run to the floor.
 * Prove: a new bonus and range. Find the best reply.
 */
export class TravelersDilemmaGame extends Game {
  readonly slug = "travelers-dilemma";
  private g: Travelers = FEEL_GAME;
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private partner: number[] = [];
  private mine = 0;
  private since = 0;
  private readonly youR = new Damped(0, 0.4);
  private readonly altR = new Damped(0, 0.4);
  private readonly themR = new Damped(0, 0.4);
  private readonly shown = new Damped(0, 0.4);
  private readonly intro = new Damped(0, 0.7);

  private readonly sl = new Slider();
  private dragging = false;
  private reached = false;
  private visited = new Set<number>();

  private cases: TravelCase[] = [];
  private pi = 0;
  private locked = false;
  private solved = 0;
  private wait = 0;
  private readonly trueAt = new Damped(0, 0.5);

  private readonly claim = this.add(new CanvasButton("Claim", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.g = FEEL_GAME;
    this.round = 0;
    this.partner = partnerClaims(this.env.rng);
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.reached = false;
    this.setBeat("feel");
    this.startRound();
  }

  private startRound(): void {
    this.stage = "choose";
    this.sl.range(this.g.lo, this.g.hi, 1);
    this.sl.value = 6;
    this.shown.snap(0);
    this.youR.snap(this.rad(10));
    this.altR.snap(0);
    this.themR.snap(this.rad(10));
    this.prompt.set(this.round === 0 ? "Name a claim from 2 to 10." : "Again. Name your claim.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = ROUNDS;
    this.enterSee();
    if (beat === "see") return;
    this.reached = true;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.claim.place(this.cx - 80, by, 160);
    this.next.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.sl.place(f.x + 24, f.x + f.w - 24, f.bottom - 34);
  }

  private sync(): void {
    this.claim.visible = this.beat === "feel" && this.stage === "choose";
    this.next.visible = this.beat === "feel" && this.stage === "result";
    this.next.label = this.round >= ROUNDS ? "See why" : "Next";
    this.toProve.visible = this.beat === "see" && this.reached;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  private rad(v: number): number {
    return Math.sqrt(Math.max(v, 0.01) / 12);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const live = (this.beat === "feel" && this.stage === "choose") || this.beat === "see" || (this.beat === "prove" && !this.locked);
    if (live && this.sl.hit(x, y)) {
      this.dragging = true;
      this.move(x);
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.dragging) this.move(x);
  }

  protected override onUp(): void {
    this.dragging = false;
  }

  private move(x: number): void {
    const before = this.sl.value;
    this.sl.setFromX(x);
    if (this.beat === "see") this.seeStep(before, this.sl.value);
  }

  // ---- Feel -------------------------------------------------------------

  private commit(): void {
    if (this.stage !== "choose") return;
    this.mine = this.sl.value;
    const theirs = this.partner[this.round]!;
    const alt = this.mine > this.g.lo ? this.mine - 1 : this.mine + 1;
    this.youR.set(this.rad(this.g.payoff(this.mine, theirs)));
    this.altR.set(this.rad(this.g.payoff(alt, theirs)));
    this.themR.set(this.rad(this.g.payoff(theirs, this.mine)));
    this.stage = "wait";
    this.since = 0;
    this.cue("good");
    this.sync();
  }

  private reveal(): void {
    const theirs = this.partner[this.round]!;
    const pay = this.g.payoff(this.mine, theirs);
    const lower = this.mine > this.g.lo;
    const alt = lower ? this.mine - 1 : this.mine + 1;
    this.shown.set(1);
    this.stage = "result";
    this.round++;
    this.note.set(`They claimed ${theirs}. You got ${pay}. ${lower ? "One lower" : "One higher"} paid ${this.g.payoff(alt, theirs)}.`);
    this.announce(`Round ${this.round}. They claimed ${theirs}. You claimed ${this.mine} and got ${pay}. ${lower ? "One lower" : "One higher"} would have paid ${this.g.payoff(alt, theirs)}.`);
    this.prompt.set(this.round >= ROUNDS ? "Three rounds. Compare with one lower." : "That is what each claim paid.");
    this.sync();
  }

  private nextRound(): void {
    if (this.stage !== "result") return;
    if (this.round >= ROUNDS) return this.enterSee();
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.g = FEEL_GAME;
    this.sl.range(this.g.lo, this.g.hi, 1);
    this.sl.value = 10;
    this.visited = new Set([10]);
    this.reached = false;
    this.prompt.set("Drag their claim down. Your best reply?");
    this.note.set("They claim 10. Claim 9 and you get 11.");
    this.sync();
  }

  private seeStep(from: number, to: number): void {
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    for (let v = lo; v <= hi; v++) this.visited.add(v);
    const c = to;
    const reply = this.g.bestReply(c);
    this.note.set(reply === c ? `They claim ${c}. That is the floor.` : `They claim ${c}. Claim ${reply} and get ${this.g.payoff(reply, c)}, not ${c}.`);
    if (!this.reached && this.visited.has(this.g.lo + 1)) {
      this.reached = true;
      this.cue("good");
      this.prompt.set("Every step pays. It ends at the floor.");
      this.announce("Each time, one below pays more. The chain runs from 10 down to 2.");
      this.sync();
    }
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_POOL).slice(0, 2);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const q = this.cases[this.pi]!;
    this.g = q.game;
    this.sl.range(q.game.lo, q.game.hi, 1);
    this.sl.value = q.partner;
    this.locked = false;
    this.trueAt.snap(0);
    this.prompt.set(this.pi === 0 ? `They claim ${q.partner}. Your best reply?` : `Now they claim ${q.partner}. Best reply?`);
    this.note.set("Drag your claim. The bonus is shown.");
    this.sync();
  }

  private lockIn(): void {
    const q = this.cases[this.pi]!;
    const x = this.sl.value;
    const best = this.g.bestReply(q.partner);
    this.cue(x === best ? "good" : "bad");
    if (x === best) {
      this.locked = true;
      this.solved++;
      this.trueAt.set(1);
      this.prompt.set(best === q.partner ? "Right. Matching is best here." : `Right. One below, ${best}.`);
      this.note.set(best === q.partner ? `Undercutting pays ${fmt(this.g.payoff(q.partner - 1, q.partner))}, matching pays ${q.partner}.` : `${best} pays ${fmt(this.g.payoff(best, q.partner))}, matching pays ${q.partner}.`);
      this.wait = 2;
    } else {
      this.prompt.set("Not quite. Compare the payoffs.");
      this.note.set(`${x} pays ${fmt(this.g.payoff(x, q.partner))}. ${best} pays ${fmt(this.g.payoff(best, q.partner))}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.altR.step(dt);
    this.themR.step(dt);
    this.shown.step(dt);
    this.trueAt.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 0.9) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Undercutting pays when the bonus beats one.");
          this.note.set("Logic runs to the floor. People rarely follow.");
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
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawProve(p, c, f);
  }

  private shapes(p: Painter, c: Colors, f: Frame, youV: number, altV: number, themV: number, labels: [string, string] | null, a: number): void {
    const R = clamp((f.h - 110) / 2, 18, 44);
    const cy = f.top + R + 6;
    const off = Math.min(86, f.w / 2 - R - 10);
    p.dashedRing(this.cx - off, cy, altV * R, c.ink, 0.85);
    p.disc(this.cx - off, cy, youV * R, c.ink, 0.92 * a);
    p.ring(this.cx + off, cy, themV * R, c.ink, 1.5, a);
    if (labels) {
      p.text(labels[0], this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
      p.text(labels[1], this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center", alpha: a });
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const t = this.shown.value;
    const theirs = this.partner[Math.min(this.round - (this.stage === "result" ? 1 : 0), ROUNDS - 1)]!;
    const pay = this.g.payoff(this.mine, theirs);
    const labels: [string, string] | null = t > 0.5 ? [`you ${this.mine}, paid ${pay}`, `they ${theirs}, paid ${this.g.payoff(theirs, this.mine)}`] : [`you`, `partner`];
    this.shapes(p, c, f, this.youR.value, this.altR.value, this.themR.value, labels, a);
    this.sl.draw(p, c, { ticks: [2, 6, 10], text: (v) => `claim ${v}`, alpha: a });
    for (let i = 0; i < ROUNDS; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, i < this.round, i === this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const g = this.g;
    const cl = this.sl.value;
    const reply = g.bestReply(cl);
    const R = clamp((f.h - 110) / 2, 18, 40);
    const cy = f.top + R + 6;
    const off = Math.min(86, f.w / 2 - R - 10);
    const match = g.payoff(cl, cl);
    const under = g.payoff(reply, cl);
    p.dashedRing(this.cx - off, cy, R * Math.sqrt(match / 12), c.ink, 0.85);
    p.disc(this.cx + off, cy, R * Math.sqrt(under / 12), c.ink, 0.92);
    p.text(`match ${match}`, this.cx - off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    p.text(`reply ${reply} pays ${under}`, this.cx + off, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    for (const v of this.visited) {
      if (v > g.lo) p.disc(this.sl.X(v - 1), this.sl.y - 14, 2.5, c.ink, 0.5);
    }
    this.sl.draw(p, c, { ticks: [2, 6, 10], text: (v) => `they ${v}`, ring: true });
    for (let i = 0; i < 2; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, this.reached ? true : i < 1, i === (this.reached ? 99 : 1));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const q = this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    const R = clamp((f.h - 120) / 2, 18, 34);
    const cy = f.top + R + 4;
    p.ring(this.cx, cy, R, c.ink, 1.5, 1);
    p.text(String(q.partner), this.cx, cy, { font: Type.mono(16), color: c.ink, align: "center", base: "middle" });
    p.text(`bonus ${fmt(q.game.bonus)}, claims ${q.game.lo} to ${q.game.hi}`, this.cx, cy + R + 16, { font: Type.mono(11), color: c.fog, align: "center" });
    const mid = Math.round((q.game.lo + q.game.hi) / 2);
    this.sl.draw(p, c, { ticks: [q.game.lo, mid, q.game.hi], text: (v) => `claim ${v}` });
    const tv = this.trueAt.value;
    if (tv > 0.01) p.ring(this.sl.X(q.game.bestReply(q.partner)), this.sl.y, 13, c.ink, 1.25, tv);
    for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }
}
