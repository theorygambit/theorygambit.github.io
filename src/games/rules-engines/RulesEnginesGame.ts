import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { drawChoice } from "../shared/kit";
import { FEEL_LIST, FEEL_ROUNDS, OFFERS, SEE_PLAYER, feelPlayers, proveSet, RuleList, type RulePuzzle, type Trait } from "./model";

const who = (t: readonly Trait[]): string => (t.length ? t.join(", ") : "no traits");

/**
 * Feel: players arrive with traits and a list of rules decides their offer. Guess the offer.
 * See: tap a rule to move it to the top of the list. The order decides who gets what.
 * Prove: new lists and players. Say which offer fires.
 */
export class RulesEnginesGame extends Game {
  readonly slug = "rules-engines";
  private players: (readonly Trait[])[] = [];
  private round = 0;
  private stage: "choose" | "shown" = "choose";
  private armed = -1;
  private picked = -1;
  private readonly show = new Damped(0, 0.5);

  private list = FEEL_LIST;
  private readonly ys = new Map<Trait, Damped>();
  private tapped = new Set<Trait>();

  private cases: RulePuzzle[] = [];
  private pi = 0;
  private locked = false;
  private wrong = false;
  private wait = 0;
  private solved = 0;

  private readonly next = this.add(new CanvasButton("Next", () => this.nextRound(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.players = feelPlayers(this.env.rng);
    this.round = 0;
    this.solved = 0;
    this.list = FEEL_LIST;
    this.setBeat("feel");
    this.startRound();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    for (let i = 0; i < FEEL_ROUNDS; i++) {
      this.choose(i % 4);
      if (i < FEEL_ROUNDS - 1) this.nextRound();
    }
    this.enterSee();
    if (beat === "see") return;
    for (let i = 0; i < 3; i++) this.tapRow(i);
    this.enterProve();
  }

  protected override get actionH(): number {
    return this.beat === "see" ? 44 : this.compact ? 60 : 68;
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    this.next.visible = feel && this.stage === "shown" && this.round < FEEL_ROUNDS - 1;
    this.toSee.visible = feel && this.stage === "shown" && this.round >= FEEL_ROUNDS - 1;
    this.toProve.visible = this.beat === "see" && this.tapped.size >= 3;
  }

  private box(i: number): { x: number; y: number; w: number; h: number } {
    const f = this.frame;
    const gap = 6;
    const bw = (f.w - 3 * gap) / 4;
    return { x: f.x + i * (bw + gap), y: f.actionY, w: bw, h: f.actionH };
  }

  private hit(i: number, x: number, y: number): boolean {
    const b = this.box(i);
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  private rowH(f: Frame): number {
    return Math.max(26, Math.min(46, (f.h - 54) / 4));
  }

  private rowY(f: Frame, i: number): number {
    return f.top + 50 + i * this.rowH(f);
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") {
      const f = this.frame;
      for (let i = 0; i < 3; i++) {
        const yy = this.rowY(f, i);
        if (y >= yy && y <= yy + this.rowH(f) - 4) this.tapRow(i);
      }
      return;
    }
    const open = (this.beat === "feel" && this.stage === "choose") || (this.beat === "prove" && !this.locked);
    if (open) this.armed = [0, 1, 2, 3].find((i) => this.hit(i, x, y)) ?? -1;
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = -1;
    if (a < 0 || !this.hit(a, x, y)) return;
    if (this.beat === "feel" && this.stage === "choose") this.choose(a);
    else if (this.beat === "prove" && !this.locked) this.answerProve(a);
  }

  // ---- Feel -------------------------------------------------------------

  private startRound(): void {
    this.stage = "choose";
    this.picked = -1;
    this.show.snap(0);
    this.prompt.set("A player arrives. Which offer will the rules give?");
    this.note.set(`Player ${this.round + 1} of ${FEEL_ROUNDS}. Rules run from the top.`);
    this.sync();
  }

  private choose(i: number): void {
    const t = this.players[this.round]!;
    const fired = this.list.fired(t);
    const offer = this.list.offer(t);
    this.picked = i;
    this.stage = "shown";
    this.show.set(1);
    const ok = OFFERS[i] === offer;
    const m = this.list.matches(t);
    this.prompt.set(fired < 0 ? "No rule matched. Nothing is offered." : `Rule ${fired + 1} fired: ${offer}.`);
    this.note.set(m.length > 1 ? `Rule ${m[1]! + 1} matched too, but the first match wins.` : ok ? "You read it right." : `You guessed ${OFFERS[i]}.`);
    this.announce(`The offer is ${offer}.`);
    this.cue(ok ? "good" : "bad");
    this.sync();
  }

  private nextRound(): void {
    this.round++;
    this.startRound();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.list = FEEL_LIST;
    this.tapped = new Set();
    this.ys.clear();
    this.list.rules.forEach((r, i) => this.ys.set(r.when, new Damped(i, 0.3)));
    this.prompt.set("Tap a rule to move it to the top.");
    this.note.set(`This player has ${who(SEE_PLAYER)}, so every rule matches. Offer: ${this.list.offer(SEE_PLAYER)}.`);
    this.sync();
  }

  private tapRow(i: number): void {
    const rule = this.list.rules[i]!;
    this.list = this.list.toTop(i);
    this.list.rules.forEach((r, k) => this.ys.get(r.when)?.set(k));
    this.tapped.add(rule.when);
    this.cue("good");
    if (this.tapped.size >= 3) {
      this.prompt.set("Order decides who gets what.");
      this.note.set(`${rule.when} on top gives ${this.list.offer(SEE_PLAYER)}. Same player, same rules.`);
      this.announce("The same player gets a different offer depending on the order of the rules.");
    } else {
      this.note.set(`${rule.when} on top gives ${this.list.offer(SEE_PLAYER)}. ${this.tapped.size} of 3 tried.`);
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = proveSet(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    const c = this.cases[this.pi]!;
    this.list = c.list;
    this.locked = false;
    this.wrong = false;
    this.show.snap(0);
    this.picked = -1;
    this.prompt.set(`A player with ${who(c.traits)}. Which offer fires?`);
    this.note.set("Read the rules from the top.");
    this.sync();
  }

  private answerProve(i: number): void {
    const c = this.cases[this.pi]!;
    const offer = c.list.offer(c.traits);
    const ok = OFFERS[i] === offer;
    this.picked = i;
    this.show.snap(0).set(1);
    this.cue(ok ? "good" : "bad");
    const fired = c.list.fired(c.traits);
    if (ok) {
      this.locked = true;
      this.solved++;
      this.prompt.set(`Right. Rule ${fired + 1} fired first.`);
      this.note.set(`The rules below it never run for this player.`);
      this.wait = 2;
    } else {
      this.wrong = true;
      this.prompt.set(`Not ${OFFERS[i]}. Rule ${fired + 1} fired first.`);
      this.note.set(`It gives ${offer}. Later matches do not count.`);
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.show.step(dt);
    for (const d of this.ys.values()) d.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("A rules engine is an ordered list. The first match wins.");
          this.note.set("Test a change on part of the players before you roll it out to all.");
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
    const traits: readonly Trait[] = this.beat === "feel" ? this.players[Math.min(this.round, this.players.length - 1)]! : this.beat === "see" ? SEE_PLAYER : this.cases[Math.min(this.pi, this.cases.length - 1)]!.traits;
    const reveal = this.beat === "see" ? 1 : this.show.value;
    this.drawRules(p, c, f, this.list, traits, reveal);
    if (this.beat !== "see") {
      const open = this.beat === "feel" ? this.stage === "choose" : !this.locked;
      OFFERS.forEach((o, i) => {
        drawChoice(p, c, this.box(i), { label: o, sub: "", r: 0, armed: this.armed === i, chosen: this.picked === i, alpha: open || (this.beat === "prove" && this.wrong) ? 1 : 0 });
      });
    }
    if (this.beat === "feel") for (let i = 0; i < FEEL_ROUNDS; i++) Glyph.step(p, c, this.cx - 40 + i * 20, f.tickY, i < this.round || (i === this.round && this.stage === "shown"), i === this.round && this.stage === "choose");
    else if (this.beat === "see") for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, this.tapped.size > i, false);
    else for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
  }

  private drawRules(p: Painter, c: Colors, f: Frame, list: RuleList, traits: readonly Trait[], reveal: number): void {
    p.ring(f.x + 12, f.top + 14, 8, c.ink, 1.5);
    p.text(who(traits), f.x + 30, f.top + 14, { font: Type.body(15, 400), color: c.ink, base: "middle" });
    const rh = this.rowH(f);
    const fired = list.fired(traits);
    const matches = list.matches(traits);
    for (let i = 0; i < 4; i++) {
      const isDefault = i === 3;
      const rule = isDefault ? null : list.rules[i]!;
      const yv = rule && this.beat === "see" ? this.ys.get(rule.when)?.value ?? i : i;
      const y = f.top + 50 + yv * rh;
      const isFired = fired === i || (isDefault && fired < 0);
      const shadow = !isDefault && matches.includes(i) && !isFired;
      const hot = reveal > 0.01 && isFired;
      p.frame(f.x, y, f.w, rh - 6, c.ink, hot ? 0.9 : 0.25);
      const my = y + (rh - 6) / 2;
      p.text(isDefault ? "otherwise" : `${i + 1}  if ${rule!.when}`, f.x + 28, my, { font: Type.body(14, 400), color: c.ink, base: "middle" });
      p.text(isDefault ? "none" : rule!.give, f.x + f.w - 12, my, { font: Type.body(14, 400), color: c.fog, align: "right", base: "middle" });
      if (reveal > 0.01 && isFired) p.disc(f.x + 14, my, 4.5, c.ink, reveal);
      else if (reveal > 0.01 && shadow) p.dashedRing(f.x + 14, my, 4.5, c.ink, reveal);
    }
  }
}
