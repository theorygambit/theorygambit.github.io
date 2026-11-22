import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { inside } from "../shared/MatrixView";
import { Slider, drawChoice, drawTicks, fmt } from "../shared/kit";
import { FEEL_GIFTS, Gift, followedIntention, proveGifts } from "./model";

const word = (r: number): string => (r > 0 ? `Reward ${r}` : r < 0 ? `Punish ${-r}` : "No reply");

/**
 * Feel: four strangers each give you coins. You see what they gave and what they could have given, then reward or punish.
 * See: each reply on a plane of what they gave against what they could have given. Replies follow the side of the line.
 * Prove: three new gifts. Tap reward or punish, judging the choice and not the size.
 */
export class ReciprocityFairnessGame extends Game {
  readonly slug = "reciprocity-fairness";
  private gifts: Gift[] = [];
  private replies: number[] = [];
  private round = 0;
  private waiting = false;
  private since = 0;
  private readonly slider = new Slider();
  private readonly giveV = new Damped(0, 0.4);
  private readonly altV = new Damped(0, 0.4);

  private shown = 0;
  private readonly dots: Damped[] = [0, 1, 2, 3].map(() => new Damped(0, 0.5));
  private readonly sides = new Damped(0, 0.5);

  private cases: Gift[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: "reward" | "punish" | null = null;
  private armed: "reward" | "punish" | null = null;

  private readonly respond = this.add(new CanvasButton("Respond", () => this.commit(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.gifts = this.env.rng.shuffle(FEEL_GIFTS);
    this.replies = [];
    this.round = 0;
    this.waiting = false;
    this.slider.value = 0.5;
    this.shown = 0;
    this.dots.forEach((d) => d.snap(0));
    this.sides.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.loadGift();
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.replies = this.gifts.map((g) => g.typical);
    this.round = 4;
    this.enterSee();
    if (beat === "see") {
      for (let i = 0; i < 5; i++) this.advance();
      return;
    }
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "feel" || this.beat === "see" ? 44 : this.compact ? 80 : 96;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.respond, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    this.respond.visible = this.beat === "feel" && !this.waiting && this.round < 4;
    this.toSee.visible = this.beat === "feel" && this.round >= 4 && !this.waiting;
    this.toProve.visible = this.beat === "see" && this.shown >= 5;
  }

  private reply(): number {
    return Math.round(this.slider.value * 6) - 3;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const f = this.frame;
    if (this.beat === "feel") {
      if (!this.waiting && this.round < 4 && y >= f.top && y <= f.bottom) {
        this.slider.dragging = true;
        this.slider.setFromX(x, 1 / 6);
        this.note.set("");
      }
    } else if (this.beat === "see") this.advance();
    else if (this.beat === "prove" && !this.locked) {
      if (inside(this.pair(0), x, y)) this.armed = "reward";
      else if (inside(this.pair(1), x, y)) this.armed = "punish";
    }
  }

  protected override onMove(x: number, _y: number): void {
    if (this.slider.dragging) this.slider.setFromX(x, 1 / 6);
  }

  protected override onUp(x: number, y: number): void {
    this.slider.dragging = false;
    const a = this.armed;
    this.armed = null;
    if (a && this.beat === "prove" && !this.locked && inside(this.pair(a === "reward" ? 0 : 1), x, y)) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private loadGift(): void {
    const g = this.gifts[this.round]!;
    this.giveV.set(g.given);
    this.altV.set(g.alt);
    this.slider.value = 0.5;
    this.prompt.set(this.round === 0 ? "A stranger gave you coins. Reward or punish?" : "Another stranger. Reward or punish?");
    this.note.set("Drag to the reply you would give.");
  }

  private commit(): void {
    const r = this.reply();
    this.replies.push(r);
    this.waiting = true;
    this.since = 0;
    this.cue(r >= 0 ? "good" : "bad");
    this.prompt.set(word(r) + ".");
    this.note.set(r > 0 ? `You send them ${r}.` : r < 0 ? `You take ${-r} from them.` : "You leave it as it is.");
    this.announce(`Stranger ${this.round + 1}. ${word(r)}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.shown = 0;
    this.dots.forEach((d) => d.snap(0));
    this.sides.snap(0);
    this.prompt.set("Each reply, by what they gave and could have given.");
    this.note.set("Tap to place your four replies.");
    this.sync();
  }

  private advance(): void {
    if (this.shown >= 5) return;
    if (this.shown < 4) {
      this.dots[this.shown]!.set(1);
      this.shown++;
      this.note.set(`${this.shown} of 4 placed. Disc: reward. Ring: punish.`);
      if (this.shown === 4) {
        this.prompt.set("Tap once more to draw the line.");
      }
    } else {
      this.shown = 5;
      this.sides.set(1);
      const n = followedIntention(this.gifts, this.replies);
      this.prompt.set("Replies follow the side of the line, not the size.");
      this.note.set(`${n} of 4 of your replies followed the intention.`);
      this.announce(`${n} of 4 replies followed the intention.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveGifts(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
    this.sync();
  }

  private loadCase(): void {
    const g = this.cases[this.pi]!;
    this.locked = false;
    this.wrong = null;
    this.giveV.snap(g.given);
    this.altV.snap(g.alt);
    this.prompt.set(this.pi === 0 ? "New stranger. What does a fair person do?" : "Another. Judge the choice.");
    this.note.set("Compare what they gave with what they could have given.");
    this.sync();
  }

  private answer(a: "reward" | "punish"): void {
    const g = this.cases[this.pi]!;
    if (a === g.verdict) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      this.prompt.set(a === "reward" ? "Right. They gave more than they had to." : "Right. They gave less than they could.");
      this.note.set(`Gave ${fmt(g.given)}, could have given ${fmt(g.alt)}.`);
      this.wait = 2.2;
    } else {
      this.cue("bad");
      this.wrong = a;
      this.prompt.set("Not quite. Compare it to what they could have given.");
      this.note.set(`They gave ${fmt(g.given)} and could have given ${fmt(g.alt)}.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.giveV.step(dt);
    this.altV.step(dt);
    this.sides.step(dt);
    for (const d of this.dots) d.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.since > 1.4) {
        this.waiting = false;
        this.round++;
        if (this.round < 4) this.loadGift();
        else {
          this.prompt.set("Four strangers. Look at what you did.");
          this.note.set("");
        }
        this.sync();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("People repay the choice, not the amount.");
          this.note.set("A small gift freely given earns more than a big one that was a bargain for them.");
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
    if (this.beat === "see") this.drawSee(p, c, f);
    else this.drawGift(p, c, f);
  }

  private drawGift(p: Painter, c: Colors, f: Frame): void {
    const prove = this.beat !== "feel";
    const R = clamp((f.h - (prove ? 60 : 112)) / 2, 18, 54);
    const cy = f.top + R + 8;
    const off = Math.min(84, f.w / 2 - R - 30);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const r = (v: number) => R * Math.sqrt(Math.max(0, v) / 10);
    const g = prove ? this.cases[Math.min(this.pi, this.cases.length - 1)]! : this.gifts[Math.min(this.round, 3)]!;
    const dim = this.wrong ? 1 : 1;
    if (this.giveV.value > 0.05) p.disc(xl, cy, r(this.giveV.value), c.ink, 0.92 * dim);
    if (this.altV.value > 0.05) p.dashedRing(xr, cy, r(this.altV.value), c.ink, 0.85);
    const ly = cy + R + 20;
    p.text(`Gave ${fmt(g.given)}`, xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    p.text(`Could have given ${fmt(g.alt)}`, xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center" });
    if (!prove && this.round < 4) {
      const ty = Math.min(f.bottom - 30, ly + 58);
      this.slider.place(f.x + 24, f.x + f.w - 24, ty);
      this.slider.draw(p, c, this.waiting ? 0.4 : 1);
      p.text("punish", this.slider.at(0), ty + 24, { font: Type.body(11, 400), color: c.ash, align: "left" });
      p.text("reward", this.slider.at(1), ty + 24, { font: Type.body(11, 400), color: c.ash, align: "right" });
      p.text(word(this.reply()), this.cx, ty - 22, { font: Type.mono(12), color: c.ink, align: "center" });
    }
    if (prove) {
      for (const i of [0, 1] as const) {
        const a = i === 0 ? "reward" : "punish";
        const al = this.wrong === a ? 0.35 : this.locked && g.verdict !== a ? 0.3 : 1;
        drawChoice(p, c, this.pair(i), { label: a === "reward" ? "Reward" : "Punish", sub: a === "reward" ? "they chose to give" : "they chose to take", r: 10, alpha: al, armed: this.armed === a });
      }
      drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
    } else drawTicks(p, c, f, this.cx, 4, this.round, Math.min(this.round, 3));
  }

  private drawSee(p: Painter, c: Colors, f: Frame): void {
    const side = Math.min(f.w - 70, f.h - 64, 240);
    const x0 = this.cx - side / 2 + 10;
    const y0 = f.top + 20 + (f.h - 64 - side) / 2;
    const X = (v: number) => x0 + (v / 9) * side;
    const Y = (v: number) => y0 + side - (v / 9) * side;
    p.rule(x0, y0, x0, y0 + side, c.ink, 0.5);
    p.rule(x0, y0 + side, x0 + side, y0 + side, c.ink, 0.5);
    p.text("could have given", x0, y0 - 11, { font: Type.body(11, 400), color: c.fog, base: "middle" });
    p.text("gave", x0 + side, y0 + side + 16, { font: Type.body(11, 400), color: c.fog, align: "right" });
    const k = this.sides.value;
    if (k > 0.01) {
      p.line(X(0), Y(0), X(9), Y(9), c.ink, 1, 0.5 * k, [4, 4]);
      p.text("kind", X(8.2), Y(1.1), { font: Type.body(11, 400), color: c.ink, align: "center", base: "middle", alpha: k });
      p.text("unkind", X(1.4), Y(8.2), { font: Type.body(11, 400), color: c.ink, align: "center", base: "middle", alpha: k });
    }
    this.gifts.forEach((g, i) => {
      const a = this.dots[i]!.value;
      if (a < 0.01) return;
      const rep = this.replies[i]!;
      const rad = 4 + Math.abs(rep) * 2;
      if (rep > 0) p.disc(X(g.given), Y(g.alt), rad * a, c.ink, 0.92);
      else if (rep < 0) p.ring(X(g.given), Y(g.alt), rad * a, c.ink, 1.5, 1);
      else p.rule(X(g.given) - 5, Y(g.alt), X(g.given) + 5, Y(g.alt), c.ink, 0.9);
    });
    drawTicks(p, c, f, this.cx, 5, this.shown, Math.min(this.shown, 4));
  }
}
