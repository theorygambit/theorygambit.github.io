import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { Glyph } from "../shared/glyphs";
import { FEEL_PILE, PROVE_POOL, type Pile, type PileCase } from "./model";

interface Move {
  before: number;
  take: number;
}

/**
 * Feel: take 1 or 2 stones from seven. Whoever takes the last stone wins, and the other player never slips.
 * See: label the piles from zero up. Every third pile is lost for whoever must move.
 * Prove: new sizes and a new limit. Take the move that leaves a lost pile.
 */
export class BackwardInductionGame extends Game {
  readonly slug = "backward-induction";
  private pile: Pile = FEEL_PILE;
  private left = 7;
  private turn: "you" | "them" | "over" = "you";
  private mine: Move[] = [];
  private since = 0;
  private readonly stones = new Damped(7, 0.4);
  private readonly intro = new Damped(0, 0.7);
  private games = 0;

  private known = 0;
  private readonly lit: Damped[] = Array.from({ length: 8 }, () => new Damped(0, 0.4));

  private cases: PileCase[] = [];
  private pi = 0;
  private solved = 0;
  private done = false;
  private wait = 0;

  private readonly take = [1, 2, 3].map((n) => this.add(new CanvasButton(`Take ${n}`, () => this.takeStones(n))));
  private readonly again = this.add(new CanvasButton("Again", () => this.restart()));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.pile = FEEL_PILE;
    this.games = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.setBeat("feel");
    this.restart();
  }

  private restart(): void {
    this.left = this.pile.size;
    this.stones.snap(this.left);
    this.turn = "you";
    this.mine = [];
    this.prompt.set(this.games === 0 ? "Take 1 or 2. Last stone wins." : "Again. Take 1 or 2.");
    this.note.set("");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.known = 0;
    this.enterSee();
    if (beat === "see") return;
    this.known = 8;
    this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    this.placeButtons(this.pile.max);
  }

  private placeButtons(max: number): void {
    const f = this.frame;
    const by = this.buttonY;
    const gap = 8;
    const w = (f.w - gap * (max - 1)) / max;
    this.take.forEach((b, i) => b.place(f.x + i * (w + gap), by, w));
    const a = this.pair(0);
    const b = this.pair(1);
    this.again.place(a.x, by, a.w);
    this.toSee.place(b.x, by, b.w);
  }

  private sync(): void {
    const feel = this.beat === "feel";
    const prove = this.beat === "prove";
    this.take.forEach((b, i) => {
      b.visible = i < this.pile.max && ((feel && this.turn === "you") || (prove && !this.done));
    });
    this.again.visible = feel && this.turn === "over";
    this.toSee.visible = feel && this.turn === "over";
    this.toProve.visible = this.beat === "see" && this.known >= 8;
  }

  // ---- Feel and Prove: taking -------------------------------------------

  private takeStones(n: number): void {
    if (this.beat === "feel" && this.turn === "you") {
      const t = Math.min(n, this.left);
      this.mine.push({ before: this.left, take: t });
      this.left -= t;
      this.stones.set(this.left);
      this.cue("good");
      if (this.left === 0) return this.finishGame(true);
      this.turn = "them";
      this.since = 0;
      this.prompt.set("They take.");
      this.note.set("");
      this.sync();
    } else if (this.beat === "prove" && !this.done) {
      this.provePick(n);
    }
  }

  private theirMove(): void {
    const t = this.pile.reply(this.left, this.env.rng);
    this.left -= t;
    this.stones.set(this.left);
    if (this.left === 0) return this.finishGame(false);
    this.turn = "you";
    this.prompt.set(`${this.left} left. Take 1 or 2.`);
    this.sync();
  }

  private finishGame(won: boolean): void {
    this.turn = "over";
    this.games++;
    if (won) {
      const leftBy = this.mine.map((m) => m.before - m.take).filter((n) => n > 0);
      this.prompt.set("You took the last stone.");
      this.note.set(`You left them ${leftBy.join(", ")}, then 0.`);
      this.announce(`You took the last stone. You left them ${leftBy.join(", ")}.`);
    } else {
      const slip = this.mine.find((m) => this.pile.winningTakes(m.before).length > 0 && !this.pile.winningTakes(m.before).includes(m.take));
      this.prompt.set("They took the last stone.");
      const msg = slip ? `At ${slip.before}, taking ${this.pile.winningTakes(slip.before)[0]} would have won.` : "Every pile you faced was lost.";
      this.note.set(msg);
      this.announce(msg);
    }
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.known = 0;
    for (const d of this.lit) d.snap(0);
    this.prompt.set("Tap to label the piles, from zero up.");
    this.note.set("Filled: the player to move wins. Ring: they lose.");
    this.sync();
  }

  private labelNext(): void {
    if (this.known >= 8) return;
    const n = this.known;
    this.lit[n]!.set(1);
    this.known++;
    this.cue("good");
    const lost = FEEL_PILE.lost(n);
    if (n === 0) this.note.set("0 stones: the player to move has lost.");
    else if (lost) this.note.set(`${n} stones: every take leaves a winner for them.`);
    else this.note.set(`${n} stones: take ${FEEL_PILE.winningTakes(n)[0]} and leave ${n - FEEL_PILE.winningTakes(n)[0]!}, a lost pile.`);
    if (this.known >= 8) {
      this.prompt.set("Every third pile is lost.");
      this.note.set("Leave them 6, 3 or 0 and you always win.");
      this.announce("Piles 0, 3 and 6 are lost for the player to move. Leave them a multiple of three.");
    } else this.prompt.set(this.known === 1 ? "Now one stone." : "Next pile.");
    this.sync();
  }

  protected override onDown(): void {
    if (this.beat === "see") this.labelNext();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    const three = this.env.rng.pick(PROVE_POOL.filter((c) => c.pile.max === 3));
    const two = this.env.rng.pick(PROVE_POOL.filter((c) => c.pile.max === 2));
    this.cases = this.env.rng.shuffle([three, two]);
    this.pi = 0;
    this.solved = 0;
    this.loadCase();
  }

  private loadCase(): void {
    const c = this.cases[this.pi]!;
    this.pile = c.pile;
    this.left = c.pile.size;
    this.stones.snap(this.left);
    this.done = false;
    this.prompt.set(this.pi === 0 ? `${c.pile.size} stones, take up to ${c.pile.max}. You move first.` : `${c.pile.size} stones, up to ${c.pile.max}. Your move.`);
    this.note.set("Leave them a lost pile.");
    this.placeButtons(c.pile.max);
    this.sync();
  }

  private provePick(n: number): void {
    const c = this.cases[this.pi]!;
    const t = n;
    const rest = c.pile.size - t;
    this.stones.set(rest);
    if (c.pile.winningTakes(c.pile.size).includes(t)) {
      this.cue("good");
      this.done = true;
      this.solved++;
      this.prompt.set(`Right. You leave ${rest}, a multiple of ${c.pile.max + 1}.`);
      this.note.set("Whatever they take, answer so the total is " + (c.pile.max + 1) + ".");
      this.wait = 1.9;
    } else {
      this.cue("bad");
      const w = c.pile.winningTakes(rest)[0]!;
      this.prompt.set(`Not quite. That leaves ${rest}.`);
      this.note.set(`They take ${w}, leaving ${rest - w}, a lost pile for you.`);
      this.wait = -1;
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.stones.step(dt);
    for (const d of this.lit) d.step(dt);
    if (this.beat === "feel" && this.turn === "them") {
      this.since += dt;
      if (this.since > 0.8) this.theirMove();
    }
    if (this.beat === "prove" && this.done && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Solve from the end, then leave a lost pile.");
          this.note.set("Each turn, bring the total back to a multiple.");
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
    if (this.beat === "see") this.drawLabels(p, c, f);
    else this.drawPile(p, c, f);
  }

  private drawPile(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const size = this.pile.size;
    const perRow = size > 10 ? Math.ceil(size / 2) : size;
    const rows = Math.ceil(size / perRow);
    const step = f.w / perRow;
    const r = clamp(step / 2 - 4, 6, 16);
    const rowH = r * 2 + 12;
    const y0 = f.top + Math.max(r + 24, (f.h - rows * rowH) / 2 + r - 8);
    const live = Math.round(this.stones.value);
    for (let i = 0; i < size; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = f.x + step * (col + 0.5);
      const y = y0 + row * rowH;
      if (i < live) p.disc(x, y, r, c.ink, 0.92 * a);
      else p.dashedRing(x, y, r * 0.8, c.ink, 0.6 * a);
    }
    if (this.beat === "feel") {
      const tx = this.cx;
      const ty = f.top + 12;
      if (this.turn === "you") p.disc(tx, ty, 6, c.ink, a);
      else if (this.turn === "them") p.ring(tx, ty, 6, c.ink, 1.5, a);
      for (let i = 0; i < 3; i++) Glyph.step(p, c, this.cx - 20 + i * 20, f.tickY, this.games > i, this.games === i);
    } else {
      for (let i = 0; i < this.cases.length; i++) Glyph.step(p, c, this.cx - 10 + i * 20, f.tickY, i < this.solved, i === this.pi);
    }
  }

  private drawLabels(p: Painter, c: Colors, f: Frame): void {
    const n = 8;
    const step = f.w / n;
    const y = f.top + Math.max(30, f.h * 0.35);
    for (let i = 0; i < n; i++) {
      const x = f.x + step * (i + 0.5);
      const t = this.lit[i]!.value;
      const lost = FEEL_PILE.lost(i);
      p.disc(x, y, 2, c.ink, 0.45 * (1 - t));
      if (lost) p.ring(x, y, 12 * t, c.ink, 1.5, t);
      else p.disc(x, y, 12 * t, c.ink, 0.92 * t);
      p.text(String(i), x, y + 30, { font: Type.mono(12), color: c.fog, align: "center" });
    }
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < this.known, i === this.known);
  }
}
