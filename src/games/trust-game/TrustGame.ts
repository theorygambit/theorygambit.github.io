import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Slider, drawTicks, fmt } from "../shared/kit";
import { PROVE_TOLERANCE, PROVE_TRUSTS, RETURN_SHARES, Trust } from "./model";

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * Feel: send coins to four strangers. The pot triples and each stranger decides what to send back.
 * See: for each stranger, the coins you sent against the coins that came back. Tap through them.
 * Prove: the pot now multiplies by a new number. Drag the share that makes sending break even.
 */
export class TrustGame extends Game {
  readonly slug = "trust-game";
  private readonly t = new Trust(3);
  private shares: number[] = [];
  private sent: number[] = [];
  private round = 0;
  private stage: "choose" | "wait" | "result" = "choose";
  private since = 0;
  private readonly slider = new Slider();
  private readonly keepV = new Damped(10, 0.35);
  private readonly potV = new Damped(0, 0.35);
  private readonly altV = new Damped(0, 0.4);

  private shown = 0;
  private readonly cols: Damped[] = [new Damped(0, 0.5), new Damped(0, 0.5), new Damped(0, 0.5), new Damped(0, 0.5)];

  private trusts: Trust[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private readonly settle = new Damped(0, 0.4);

  private readonly send = this.add(new CanvasButton("Send", () => this.commit(), "primary"));
  private readonly next = this.add(new CanvasButton("Next stranger", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.shares = this.env.rng.shuffle(RETURN_SHARES);
    this.sent = [];
    this.round = 0;
    this.stage = "choose";
    this.slider.value = 0.5;
    this.keepV.snap(5);
    this.potV.snap(0);
    this.altV.snap(0);
    this.shown = 0;
    this.cols.forEach((d) => d.snap(0));
    this.solved = 0;
    this.setBeat("feel");
    this.prompt.set("You hold 10 coins. Send a stranger as many as you like.");
    this.note.set("Whatever you send triples. They decide what to return.");
    this.preview();
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.sent = [6, 0, 8, 4];
    this.round = 4;
    this.stage = "result";
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 4; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return 44;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.send, this.next, this.toSee, this.toProve, this.lock]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.send.visible = feel && this.stage === "choose";
    this.next.visible = feel && this.stage === "result" && this.round < 4;
    this.toSee.visible = feel && this.stage === "result" && this.round >= 4;
    this.toProve.visible = this.beat === "see" && this.shown >= 4;
    this.lock.visible = this.beat === "prove" && !this.locked;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (this.beat === "see") this.advance();
    else if ((this.beat === "feel" && this.stage === "choose") || (this.beat === "prove" && !this.locked)) {
      if (y >= f.top && y <= f.bottom) {
        this.slider.dragging = true;
        this.drag(x);
      }
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.slider.dragging) this.drag(x);
  }

  protected override onUp(): void {
    this.slider.dragging = false;
  }

  private drag(x: number): void {
    if (this.beat === "feel") {
      this.slider.setFromX(x, 0.1);
      this.preview();
    } else {
      this.slider.setFromX(x, 0.01);
      this.note.set("");
    }
  }

  private amount(): number {
    return Math.round(this.slider.value * this.t.endow);
  }

  private preview(): void {
    const s = this.amount();
    this.keepV.set(this.t.endow - s);
    this.potV.set(this.t.pot(s));
  }

  // ---- Feel -------------------------------------------------------------

  private commit(): void {
    this.sent.push(this.amount());
    this.stage = "wait";
    this.since = 0;
    this.prompt.set(this.sent[this.round] === 0 ? "You kept it all. Nothing to return." : "The pot is tripling. They are deciding.");
    this.note.set("");
    this.sync();
  }

  private reveal(): void {
    const s = this.sent[this.round]!;
    const r = this.shares[this.round]!;
    const back = this.t.back(s, r);
    const final = this.t.final(s, r);
    this.keepV.set(final);
    this.potV.set(this.t.pot(s) - back);
    this.altV.set(this.t.endow);
    this.stage = "result";
    this.cue(final >= this.t.endow ? "good" : "bad");
    this.prompt.set(s === 0 ? "Safe. And nothing gained." : final > this.t.endow ? "They sent back more than you sent." : "They sent back less than you sent.");
    this.note.set(`You send ${fmt(s)}, get back ${fmt(back)}. You hold ${fmt(final)}. Keeping would have left 10.`);
    this.announce(`Stranger ${this.round + 1}. You sent ${s} and got back ${fmt(back)}. You hold ${fmt(final)}.`);
    this.round++;
    this.sync();
  }

  private nextRound(): void {
    this.stage = "choose";
    this.altV.snap(0);
    this.slider.value = 0.5;
    this.preview();
    this.prompt.set("A new stranger. Send as many as you like.");
    this.note.set("Whatever you send triples. They decide what to return.");
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.shown = 0;
    this.cols.forEach((d) => d.snap(0));
    this.prompt.set("Four strangers. Tap to see who sent back enough.");
    this.note.set("Filled: what you sent. Ring: what came back.");
    this.sync();
  }

  private advance(): void {
    if (this.shown >= 4) return;
    this.cols[this.shown]!.set(1);
    this.shown++;
    if (this.shown >= 4) {
      this.prompt.set("Trust paid when more than a third came back.");
      this.note.set("The dashed ring is what you sent. A ring beyond it is a gain.");
      this.announce("Trust pays when the share returned is above one third of the pot.");
    } else this.note.set(`${this.shown} of 4 shown.`);
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.trusts = this.env.rng.shuffle(PROVE_TRUSTS);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
  }

  private loadCase(): void {
    this.locked = false;
    this.slider.value = 0.5;
    this.settle.snap(0);
    const k = this.trusts[this.pi]!.mult;
    this.prompt.set(`The pot now multiplies by ${k}. Send 10.`);
    this.note.set("Drag the share they return until you break even.");
    this.sync();
  }

  private lockIn(): void {
    const tr = this.trusts[this.pi]!;
    const r = this.slider.value;
    if (Math.abs(r - tr.breakEven) <= PROVE_TOLERANCE) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.slider.value = tr.breakEven;
      this.settle.set(1);
      this.prompt.set(`Right. At ${pct(tr.breakEven)} the two areas match.`);
      this.note.set(`One over ${tr.mult} is the break even share.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      const back = tr.back(10, r);
      this.prompt.set(r < tr.breakEven ? "Too little. You would lose." : "More than you need. Find the edge.");
      this.note.set(`At ${pct(r)} you get back ${fmt(back)} for the 10 you sent.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.keepV.step(dt);
    this.potV.step(dt);
    this.altV.step(dt);
    this.settle.step(dt);
    for (const d of this.cols) d.step(dt);
    if (this.beat === "feel" && this.stage === "wait") {
      this.since += dt;
      if (this.since > 1.1) this.reveal();
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.trusts.length) {
          this.prompt.set("Trust pays above one over the multiplier.");
          this.note.set("Bigger multipliers need less returned, so more is worth risking.");
          this.finish();
          this.sync();
        } else {
          this.pi++;
          this.loadCase();
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
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 30);
    const idle = this.stage === "wait" ? 0.55 + 0.45 * Math.sin(this.time * 9) : 1;
    if (this.altV.value > 0.05) p.dashedRing(xl, cy, r(this.altV.value), c.ink, 0.8);
    if (this.keepV.value > 0.05) p.disc(xl, cy, r(this.keepV.value), c.ink, 0.95 * idle);
    if (this.potV.value > 0.05) p.ring(xr, cy, r(this.potV.value), c.ink, 1.5, idle);
    const ly = cy + R + 20;
    const done = this.stage === "result";
    const s = done ? this.sent[this.round - 1]! : this.amount();
    p.text(done ? `You hold ${fmt(this.keepV.target)}` : `You keep ${this.t.endow - s}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(done ? `They keep ${fmt(this.potV.target)}` : `Pot ${fmt(this.t.pot(s))}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (this.stage === "choose") {
      const ty = Math.min(f.bottom - 28, ly + 56);
      this.slider.place(f.x + 24, f.x + f.w - 24, ty);
      this.slider.draw(p, c);
      for (const v of [0, 5, 10]) p.text(String(v), this.slider.at(v / 10), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    }
    drawTicks(p, c, f, this.cx, 4, this.round, this.round);
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const slot = f.w / 4;
    const R30 = clamp(Math.min(slot * 0.45, (f.h - 52) / 3.2), 12, 40);
    const rr = (v: number) => R30 * Math.sqrt(Math.max(0, v) / 30);
    const y1 = f.top + 26 + rr(10);
    const y2 = y1 + rr(10) + 10 + R30;
    const yn = y2 + R30 + 18;
    for (let i = 0; i < 4; i++) {
      const k = this.cols[i]!.value;
      const x = f.x + (i + 0.5) * slot;
      const s = this.sent[i]!;
      const r = this.shares[i]!;
      const back = this.t.back(s, r);
      const net = back - s;
      if (k < 0.01) {
        p.ring(x, y2 - R30 * 0.4, 5, c.ink, 1.25, 0.3 + 0.2 * Math.sin(this.time * 4 + i));
        continue;
      }
      p.text(s === 0 ? "kept" : pct(r), x, f.top + 8, { font: Type.mono(11), color: c.fog, align: "center", alpha: k });
      if (s > 0) {
        p.disc(x, y1, rr(s), c.ink, 0.92 * k);
        p.ring(x, y2, rr(back) * k, c.ink, 1.5, k);
        p.dashedRing(x, y2, rr(s), c.ink, 0.7 * k);
      }
      p.text(s === 0 ? "0" : `${net > 0 ? "+" : net < 0 ? "-" : ""}${fmt(Math.abs(net))}`, x, yn, { font: Type.mono(12), color: c.ink, align: "center", alpha: k });
    }
    drawTicks(p, c, f, this.cx, 4, this.shown, Math.min(this.shown, 3));
  }

  private drawProve(p: Painter, c: Colors, f: Frame): void {
    const tr = this.trusts[Math.min(this.pi, this.trusts.length - 1)]!;
    const R = clamp((f.h - 112) / 2, 18, 54);
    const cy = f.top + R + 4;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const top = tr.pot(10);
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / top);
    const share = this.slider.value;
    const back = tr.back(10, share);
    p.disc(xl, cy, r(10), c.ink, 0.92);
    if (back > 0.05) p.ring(xr, cy, r(back), c.ink, 1.5);
    const ly = cy + R + 20;
    p.text("You sent 10", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`Back ${fmt(back)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    const ty = Math.min(f.bottom - 28, ly + 56);
    this.slider.place(f.x + 24, f.x + f.w - 24, ty);
    this.slider.draw(p, c);
    for (const v of [0, 0.5, 1]) p.text(pct(v), this.slider.at(v), ty + 24, { font: Type.mono(10), color: c.ash, align: "center" });
    const k = this.settle.value;
    if (k > 0.01) p.dashedRing(xr, cy, r(10), c.ink, k);
    drawTicks(p, c, f, this.cx, this.trusts.length, this.solved, this.pi);
  }
}
