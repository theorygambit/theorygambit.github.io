import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_MACHINE, MAX_SPINS, PROVE_MACHINES, START_COINS, continuation, type Decision, type Machine, type Spin } from "./model";

type Act = "again" | "stop";
const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: a three reel machine. Spin again or stop, as many times as you like up to eight.
 * See: how often you went on after a near miss and after a plain loss, against the chance the next spin wins.
 * Prove: two new machines showing a near miss. Spin again or stop, by what the machine pays on average.
 */
export class NearMissEffectGame extends Game {
  readonly slug = "near-miss-effect";
  private readonly m = FEEL_MACHINE;
  private spins: Spin[] = [];
  private reels: boolean[] = [false, false, false];
  private decisions: Decision[] = [];
  private coins = START_COINS;
  private stage: "idle" | "reeling" | "result" | "stopped" = "idle";
  private since = 0;
  private armed: Act | null = null;
  private readonly bal = new Damped(START_COINS, 0.4);

  private shown = 0;
  private readonly rows: Damped[] = [0, 1, 2].map(() => new Damped(0, 0.5));

  private machines: Machine[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: Act | null = null;
  private provePattern: boolean[] = [true, true, false];

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.spins = [];
    this.decisions = [];
    this.coins = START_COINS;
    this.stage = "idle";
    this.reels = [false, false, false];
    this.bal.snap(START_COINS);
    this.shown = 0;
    this.rows.forEach((d) => d.snap(0));
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("A spin costs 1. Three matches pay 6.");
    this.note.set("Spin as often as you like, or stop.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.spins = ["near", "loss", "near", "loss", "near", "loss"];
    this.decisions = [
      { after: "near", again: true },
      { after: "loss", again: false },
      { after: "near", again: true },
      { after: "loss", again: true },
      { after: "near", again: true },
    ];
    this.stage = "stopped";
    this.coins = 4;
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 3; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.stage === "stopped";
    this.toProve.visible = this.beat === "see" && this.shown >= 3;
  }

  private canSpin(): boolean {
    return (this.stage === "idle" || this.stage === "result") && this.spins.length < MAX_SPINS && this.coins > 0;
  }

  private canStop(): boolean {
    return this.stage === "result";
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "feel") {
      if (inside(this.pair(0), x, y) && this.canSpin()) this.armed = "again";
      else if (inside(this.pair(1), x, y) && this.canStop()) this.armed = "stop";
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      if (inside(this.pair(0), x, y)) this.armed = "again";
      else if (inside(this.pair(1), x, y)) this.armed = "stop";
    }
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = null;
    if (!a || !inside(this.pair(a === "again" ? 0 : 1), x, y)) return;
    if (this.beat === "feel") this.act(a);
    else if (this.beat === "prove" && !this.locked) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private act(a: Act): void {
    if (this.stage === "result") this.decisions.push({ after: this.spins[this.spins.length - 1]!, again: a === "again" });
    if (a === "stop") {
      this.finishPlay();
      return;
    }
    const spin = this.m.draw(this.env.rng);
    this.spins.push(spin);
    this.reels = this.m.reels(spin, this.env.rng);
    this.coins -= this.m.cost;
    if (spin === "win") this.coins += this.m.prize;
    this.bal.set(Math.max(0, this.coins));
    this.stage = "reeling";
    this.since = 0;
    this.prompt.set("Spinning.");
    this.note.set("");
    this.sync();
  }

  private finishPlay(): void {
    this.stage = "stopped";
    const net = this.coins - START_COINS;
    this.prompt.set("You stopped.");
    this.note.set(`${this.spins.length} spins. ${net >= 0 ? "Up" : "Down"} ${fmt(Math.abs(net))} coins. Never playing would have kept ${START_COINS}.`);
    this.announce(`You stopped after ${this.spins.length} spins with ${this.coins} coins.`);
    this.sync();
  }

  private settleSpin(): void {
    const s = this.spins[this.spins.length - 1]!;
    this.stage = "result";
    this.cue(s === "win" ? "good" : "bad");
    this.prompt.set(s === "win" ? "Three matches." : s === "near" ? "So close." : "Nothing.");
    const left = MAX_SPINS - this.spins.length;
    this.note.set(left > 0 && this.coins > 0 ? "Spin again or stop?" : "That was the last spin.");
    this.announce(s === "win" ? "Three matches. You win 6." : s === "near" ? "Two of three match. A near miss." : "No match.");
    if (left === 0 || this.coins <= 0) this.finishPlay();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.shown = 0;
    this.rows.forEach((d) => d.snap(0));
    this.prompt.set("Did a near miss change what you did?");
    this.note.set("Tap to compare your choices.");
    this.sync();
  }

  private advance(): void {
    if (this.shown >= 3) return;
    this.rows[this.shown]!.set(1);
    this.shown++;
    const c = continuation(this.decisions);
    if (this.shown === 1) {
      this.prompt.set(c.near.of ? `After a near miss you went on ${c.near.again} of ${c.near.of} times.` : "You never faced a near miss and a choice.");
      this.note.set("Tap for the plain losses.");
    } else if (this.shown === 2) {
      this.prompt.set(c.loss.of ? `After a plain loss you went on ${c.loss.again} of ${c.loss.of} times.` : "You never faced a plain loss and a choice.");
      this.note.set("Tap for the odds.");
    } else {
      const near = c.near.of ? c.near.again / c.near.of : 0;
      const loss = c.loss.of ? c.loss.again / c.loss.of : 0;
      this.prompt.set("The next spin wins 10% of the time either way.");
      this.note.set(c.near.of && c.loss.of ? (near > loss ? "The near miss pulled you on. It changed the feeling, not the odds." : "The feeling did not change your choice, and it should not.") : "Close or not, the odds do not move.");
      this.announce("The chance the next spin wins is 10 percent after a near miss and after a loss.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.machines = this.env.rng.shuffle(PROVE_MACHINES);
    this.pi = 0;
    this.solved = 0;
    this.loadMachine();
    this.sync();
  }

  private loadMachine(): void {
    const m = this.machines[this.pi]!;
    this.locked = false;
    this.wrong = null;
    const odd = this.env.rng.int(0, 2);
    this.provePattern = [0, 1, 2].map((i) => i !== odd);
    this.prompt.set("Two of three match. Spin again or stop?");
    this.note.set(`A win has a ${pct(m.p)} chance and pays ${m.prize}. A spin costs ${m.cost}.`);
  }

  private answer(a: Act): void {
    const m = this.machines[this.pi]!;
    const right: Act = m.ev > 0 ? "again" : "stop";
    if (a === right) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      this.prompt.set(right === "again" ? "Right. It pays on average." : "Right. It costs on average.");
      this.note.set(`Average per spin: ${m.ev > 0 ? "+" : ""}${fmt(Math.round(m.ev * 100) / 100)}. The near miss changes nothing.`);
      this.wait = 2.4;
    } else {
      this.cue("bad");
      this.wrong = a;
      this.prompt.set("Not quite. Ignore the reels. Work out the average.");
      this.note.set(`${pct(m.p)} of ${m.prize} is ${fmt(Math.round(m.p * m.prize * 100) / 100)}. A spin costs ${m.cost}.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.bal.step(dt);
    for (const d of this.rows) d.step(dt);
    if (this.beat === "feel" && this.stage === "reeling") {
      this.since += dt;
      if (this.since > 1.3) this.settleSpin();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.machines.length) {
          this.prompt.set("Judge a machine by its average, not its reels.");
          this.note.set("Almost winning is still losing, and the next spin starts from nothing.");
          this.finish();
        } else {
          this.pi++;
          this.loadMachine();
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

  private reelRow(p: Painter, c: Colors, y: number, r: number, hits: boolean[], settle: number): void {
    for (let i = 0; i < 3; i++) {
      const x = this.cx + (i - 1) * (r * 3.2);
      const done = settle >= 0.5 + 0.3 * i;
      const on = done ? hits[i]! : Math.sin(this.time * 18 + i * 2) > 0;
      if (on) p.disc(x, y, r, c.ink, done ? 0.95 : 0.55);
      else p.ring(x, y, r, c.ink, 1.5, done ? 1 : 0.55);
    }
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const r = clamp(Math.min(f.w / 12, f.h / 7), 10, 20);
    const y1 = f.top + 10 + r;
    const settle = this.stage === "reeling" ? this.since : this.stage === "idle" ? -1 : 9;
    if (this.stage === "idle") for (let i = 0; i < 3; i++) p.ring(this.cx + (i - 1) * (r * 3.2), y1, r, c.ink, 1, 0.3);
    else this.reelRow(p, c, y1, r, this.reels, settle);
    const R = clamp((f.h - 2 * r - 90) / 2, 12, 36);
    const cy = y1 + r + 26 + R;
    const rr = (v: number) => R * Math.sqrt(Math.max(0, v) / START_COINS);
    p.dashedRing(this.cx, cy, rr(START_COINS), c.ink, 0.7);
    if (this.bal.value > 0.05) p.disc(this.cx, cy, rr(this.bal.value), c.ink, 0.92);
    p.text(`${Math.max(0, this.coins)} coins`, this.cx, cy + R * 1.25 + 17, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (this.stage !== "stopped") {
      for (const i of [0, 1] as const) {
        const a: Act = i === 0 ? "again" : "stop";
        const live = a === "again" ? this.canSpin() : this.canStop();
        drawChoice(p, c, this.pair(i), { label: a === "again" ? (this.spins.length ? "Spin again" : "Spin") : "Stop", sub: a === "again" ? "costs 1" : "keep what you have", r: a === "again" ? 14 : 10, alpha: live ? 1 : 0.3, armed: this.armed === a });
      }
    }
    drawTicks(p, c, f, this.cx, MAX_SPINS, this.spins.length, Math.min(this.spins.length, MAX_SPINS - 1));
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const cont = continuation(this.decisions);
    const rowH = clamp(f.h / 3.3, 34, 60);
    const top = f.top + Math.max(0, (f.h - rowH * 3) / 2);
    const xd = f.x + f.w * 0.66;
    const rMax = rowH * 0.4;
    const font = Type.body(13, 400);
    const items: { label: string; rate: Rate }[] = [
      { label: "after a near miss", rate: cont.near },
      { label: "after a plain loss", rate: cont.loss },
    ];
    items.forEach((it, i) => {
      const y = top + (i + 0.5) * rowH;
      const a = this.rows[i]!.value;
      p.text(it.label, f.x, y, { font, color: c.ink, base: "middle", alpha: 0.5 + 0.5 * a });
      if (a < 0.01) {
        p.ring(xd, y, 3, c.ink, 1, 0.3 + 0.2 * Math.sin(this.time * 4 + i));
        return;
      }
      const v = it.rate.of ? it.rate.again / it.rate.of : 0;
      if (v > 0.01) p.disc(xd, y, rMax * Math.sqrt(v) * a, c.ink, 0.92 * a);
      p.text(it.rate.of ? `${it.rate.again} of ${it.rate.of}` : "none", xd + rMax + 12, y, { font: Type.mono(12), color: c.ink, base: "middle", alpha: a });
    });
    const a2 = this.rows[2]!.value;
    const y3 = top + 2.5 * rowH;
    p.text("next spin wins", f.x, y3, { font, color: c.ink, base: "middle", alpha: 0.5 + 0.5 * a2 });
    if (a2 < 0.01) p.ring(xd, y3, 3, c.ink, 1, 0.3 + 0.2 * Math.sin(this.time * 4 + 2));
    else {
      const rr = rMax * Math.sqrt(this.m.p) * a2;
      p.dashedRing(xd - rMax, y3, rr, c.ink, a2);
      p.dashedRing(xd + rMax, y3, rr, c.ink, a2);
      p.text(pct(this.m.p), xd + 2.6 * rMax, y3, { font: Type.mono(12), color: c.ink, base: "middle", alpha: a2 });
    }
    drawTicks(p, c, f, this.cx, 3, this.shown, Math.min(this.shown, 2));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const m = this.machines[Math.min(this.pi, this.machines.length - 1)]!;
    const r = clamp(Math.min(f.w / 12, f.h / 6), 10, 22);
    const y1 = f.top + 14 + r;
    this.reelRow(p, c, y1, r, this.provePattern, 9);
    const R = clamp((f.h - 2 * r - 80) / 2, 12, 40);
    const cy = y1 + r + 26 + R;
    const off = Math.min(84, f.w / 2 - R - 30);
    const rr = (v: number) => R * Math.sqrt(Math.max(0, v) / m.prize);
    p.disc(this.cx - off, cy, rr(m.cost), c.ink, 0.92);
    p.dashedRing(this.cx + off, cy, rr(m.prize), c.ink, 0.85);
    p.text(`Spin costs ${m.cost}`, this.cx - off, cy + R + 18, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`${pct(m.p)} to win ${m.prize}`, this.cx + off, cy + R + 18, { font: Type.body(13, 400), color: c.fog, align: "center" });
    for (const i of [0, 1] as const) {
      const a: Act = i === 0 ? "again" : "stop";
      const right: Act = m.ev > 0 ? "again" : "stop";
      const al = this.wrong === a ? 0.35 : this.locked && a !== right ? 0.3 : 1;
      drawChoice(p, c, this.pair(i), { label: a === "again" ? "Spin again" : "Stop", sub: a === "again" ? "costs 1" : "keep your coins", r: 10, alpha: al, armed: this.armed === a });
    }
    drawTicks(p, c, f, this.cx, this.machines.length, this.solved, this.pi);
  }
}

interface Rate {
  again: number;
  of: number;
}
