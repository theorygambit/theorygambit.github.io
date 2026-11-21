import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import type { Painter } from "../../core/Painter";
import { Glyph } from "../shared/glyphs";
import { GridView } from "../shared/GridView";
import type { Bimatrix } from "../shared/Bimatrix";
import { COL_NAMES, ROW_NAMES, blocking, deferredAcceptance, isStable, randomMarket, type Round } from "./model";

const CHECKS = 3;

/**
 * Feel: pair each row with a column, then check whether a pair would leave together.
 * See: replay deferred acceptance, one round per tap.
 * Prove: two new tables. Build a pairing with no pair that would both prefer to leave.
 */
export class MatchingGame extends Game {
  readonly slug = "matching";
  private readonly gv = new GridView(3, 3, 3);
  private m!: Bimatrix;
  private match: number[] = [-1, -1, -1];
  private shown: [number, number] | null = null;
  private checks = 0;
  private readonly intro = new Damped(0, 0.7);
  private readonly flash = new Damped(0, 0.4);

  private rounds: Round[] = [];
  private ridx = 0;

  private puzzles: Bimatrix[] = [];
  private pi = 0;
  private solved = 0;
  private done = false;
  private wait = 0;

  private readonly check = this.add(new CanvasButton("Check", () => this.runCheck()));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));
  private readonly lock = this.add(new CanvasButton("Lock in", () => this.lockIn(), "primary"));

  begin(): void {
    this.m = randomMarket(this.env.rng);
    this.match = [-1, -1, -1];
    this.shown = null;
    this.checks = 0;
    this.intro.snap(0).set(1);
    this.solved = 0;
    this.pi = 0;
    this.done = false;
    this.setBeat("feel");
    this.prompt.set("Pair each row with a column. 3 is best.");
    this.note.set("Tap one cell in each row and each column.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.checks = 1;
    this.enterSee();
    if (beat === "see") return;
    this.ridx = this.rounds.length;
    this.enterProve();
  }

  protected layout(): void {
    this.gv.fit(this.frame);
    const by = this.buttonY;
    const a = this.pair(0);
    const b = this.pair(1);
    this.check.place(a.x, by, a.w);
    this.toSee.place(b.x, by, b.w);
    this.toProve.place(this.cx - 80, by, 160);
    this.lock.place(this.cx - 80, by, 160);
  }

  private get full(): boolean {
    return this.match.every((c) => c >= 0);
  }

  private sync(): void {
    this.check.visible = this.beat === "feel" && this.full;
    this.toSee.visible = this.beat === "feel" && this.checks >= 1;
    this.toProve.visible = this.beat === "see" && this.ridx >= this.rounds.length;
    this.lock.visible = this.beat === "prove" && !this.done && this.full;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    if (this.beat === "see") return this.advance();
    const cell = this.gv.cellAt(x, y);
    if (!cell) return;
    if (this.beat === "feel" || (this.beat === "prove" && !this.done)) this.toggle(cell[0], cell[1]);
  }

  private toggle(r: number, c: number): void {
    if (this.match[r] === c) this.match[r] = -1;
    else {
      for (let i = 0; i < 3; i++) if (this.match[i] === c) this.match[i] = -1;
      this.match[r] = c;
    }
    this.shown = null;
    this.flash.snap(0);
    this.sync();
  }

  // ---- Feel and Prove: checking -------------------------------------------

  private explain(): boolean {
    const bl = blocking(this.m, this.match);
    if (bl.length === 0) return true;
    const [r, c] = bl[0]!;
    this.shown = [r, c];
    this.flash.snap(0);
    this.flash.set(1);
    this.prompt.set("Someone would leave.");
    this.note.set(`${ROW_NAMES[r]} and ${COL_NAMES[c]} both prefer each other to their partners.`);
    return false;
  }

  private runCheck(): void {
    if (!this.full) return;
    this.checks++;
    const ok = this.explain();
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.prompt.set("Stable. Nobody wants to leave.");
      this.note.set("No pair would both rather be together.");
      this.announce("This pairing is stable. No two would both rather leave.");
    } else this.announce(`A pair would leave together.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.rounds = deferredAcceptance(this.m).rounds;
    this.ridx = 0;
    this.match = [-1, -1, -1];
    this.shown = null;
    this.prompt.set("Tap. Rows ask for their favourite.");
    this.note.set("Columns hold the best offer and refuse the rest.");
    this.sync();
  }

  private advance(): void {
    if (this.ridx >= this.rounds.length) return;
    const r = this.rounds[this.ridx]!;
    this.ridx++;
    this.cue("good");
    const asks = [...r.asks.entries()].map(([row, col]) => `${ROW_NAMES[row]} asks ${COL_NAMES[col]}`).join(", ");
    this.note.set(`${asks}.`);
    if (this.ridx >= this.rounds.length) {
      this.prompt.set("Everyone is paired, and it is stable.");
      this.announce(`Deferred acceptance ends after ${this.rounds.length} rounds with a stable pairing.`);
    } else this.prompt.set(this.ridx === 1 ? "Refused rows ask their next choice." : "Again. Refused rows move on.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.puzzles = [randomMarket(this.env.rng), randomMarket(this.env.rng)];
    this.pi = 0;
    this.solved = 0;
    this.loadPuzzle();
  }

  private loadPuzzle(): void {
    this.m = this.puzzles[this.pi]!;
    this.match = [-1, -1, -1];
    this.shown = null;
    this.done = false;
    this.prompt.set(this.pi === 0 ? "New rankings. Build a stable pairing." : "Another market. Pair them stably.");
    this.note.set("No pair may both prefer each other.");
    this.sync();
  }

  private lockIn(): void {
    if (!this.full || this.done) return;
    if (isStable(this.m, this.match)) {
      this.cue("good");
      this.done = true;
      this.solved++;
      this.shown = null;
      this.prompt.set("Right. Nobody wants to leave.");
      this.note.set("A stable pairing always exists.");
      this.wait = 1.9;
    } else {
      this.cue("bad");
      this.explain();
    }
    this.sync();
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.flash.step(dt);
    if (this.beat === "prove" && this.done && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.puzzles.length) {
          this.prompt.set("Stable means no pair would both leave.");
          this.note.set("Who asks first shapes who is happier.");
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
    const gv = this.gv;
    const a = this.intro.value;
    gv.grid(p, c, a);
    for (let r = 0; r < 3; r++) gv.rowLabel(p, c, r, ROW_NAMES[r]!, { alpha: a, on: this.match[r]! >= 0 });
    for (let k = 0; k < 3; k++) gv.colLabel(p, c, k, COL_NAMES[k]!, { alpha: a, on: this.match.includes(k) });
    const seeing = this.beat === "see";
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) {
      let wash = 0;
      let youBest = 0;
      let ringBest = 0;
      const dashed = this.shown !== null && this.shown[0] === r && this.shown[1] === k;
      if (seeing) {
        for (let s = 0; s < this.ridx; s++) {
          const rd = this.rounds[s]!;
          if (rd.asks.get(r) === k) youBest = Math.max(youBest, s === this.ridx - 1 ? 1 : 0.35);
        }
        const last = this.ridx > 0 ? this.rounds[this.ridx - 1]! : null;
        if (last && last.holds[k] === r) {
          wash = 0.12;
          ringBest = 1;
        }
      } else if (this.match[r] === k) {
        wash = 0.12;
        youBest = 1;
        ringBest = 1;
      }
      if (dashed) wash = Math.max(wash, 0.08 * this.flash.value);
      gv.cell(p, c, r, k, this.m.mine(r, k), this.m.theirs(r, k), { alpha: a, wash, youBest, ringBest, dashed });
    }
    const n = this.beat === "feel" ? CHECKS : this.beat === "see" ? Math.max(2, this.rounds.length) : 2;
    const done = this.beat === "feel" ? Math.min(this.checks, CHECKS) : this.beat === "see" ? this.ridx : this.solved;
    for (let i = 0; i < n; i++) Glyph.step(p, c, this.cx - (n - 1) * 10 + i * 20, f.tickY, i < done, i === done && this.beat !== "done");
  }
}
