import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { clamp } from "../../core/math";
import { MatrixView } from "../shared/MatrixView";
import { BATTLE, newGame, type OrderGame } from "./model";

type Mode = "together" | "first" | "second";
const MODES: Mode[] = ["together", "first", "second"];
const SPOT = ["A", "B"] as const;
const LABEL: Record<Mode, string> = { together: "same time", first: "you first", second: "they first" };

/**
 * Feel: the same meeting game three ways. You both choose at once, you move first, or they move first.
 * See: your average payoff for each order. Moving first lets you commit, moving second lets you react.
 * Prove: three new tables. You move first. Predict where play ends by working backward from their reply.
 */
export class SimultaneousSequentialGame extends Game {
  readonly slug = "simultaneous-sequential";
  private readonly mv = new MatrixView();
  private round = 0;
  private locked = false;
  private mine: 0 | 1 | null = null;
  private theirs: 0 | 1 = 0;
  private since = 0;
  private revealed = false;
  private last: [number, number] = [0, 0];
  private readonly youR = new Damped(1, 0.35);
  private readonly theirR = new Damped(1, 0.35);
  private readonly altR = new Damped(0, 0.35);
  private readonly intro = new Damped(0, 0.7);

  private seeStep = 0;
  private readonly bars = new Damped(1, 0.5);

  private games: OrderGame[] = [];
  private pi = 0;
  private solved = 0;
  private locked2 = false;
  private wait = 0;
  private wrong = false;
  private readonly reveal = new Damped(0, 0.5);

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  protected override get actionH(): number {
    return this.beat === "feel" ? (this.compact ? 72 : 88) : 44;
  }

  private get mode(): Mode {
    return MODES[Math.min(this.round, 2)]!;
  }

  begin(): void {
    this.round = 0;
    this.locked = false;
    this.mine = null;
    this.revealed = false;
    this.youR.snap(this.scale(0));
    this.theirR.snap(this.scale(0));
    this.altR.snap(0);
    this.games = [newGame(this.env.rng), newGame(this.env.rng), newGame(this.env.rng)];
    this.pi = 0;
    this.solved = 0;
    this.seeStep = 0;
    this.bars.snap(1);
    this.intro.snap(0).set(1);
    this.setBeat("feel");
    this.roundPrompt();
    this.note.set("Both of you want to meet. You like A, they like B.");
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.round = 3;
    this.enterSee();
    this.seeStep = 2;
    this.bars.snap(3);
    this.afterStep();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    this.toSee.place(this.cx - 80, by, 160);
    this.toProve.place(this.cx - 80, by, 160);
    const f = this.frame;
    this.mv.fit(this.cx, f.top, f.w, f.h);
  }

  private sync(): void {
    this.toSee.visible = this.beat === "feel" && this.round >= 3 && !this.locked;
    this.toProve.visible = this.beat === "see" && this.seeStep >= 2;
  }

  protected override zonesActive(): Box[] | null {
    if (this.beat === "feel" && !this.locked && this.round < 3) return [this.cells(2, 0), this.cells(2, 1)];
    if (this.beat === "prove" && !this.locked2) return [0, 1, 2, 3].map((k) => this.mv.rect(k >> 1, k & 1));
    return null;
  }

  protected override onZone(i: number): void {
    if (this.beat === "feel") this.play(i as 0 | 1);
    else this.answer(i);
  }

  protected override onDown(): void {
    if (this.beat !== "see" || this.seeStep >= 2) return;
    this.seeStep++;
    this.afterStep();
  }

  // ---- Feel -------------------------------------------------------------

  private roundPrompt(): void {
    if (this.round === 0) this.prompt.set("You both choose at the same time. Where do you go?");
    else if (this.round === 1) this.prompt.set("You move first. They will see where you go.");
    else this.prompt.set("They already chose B. Where do you go?");
  }

  private scale(v: number): number {
    return v <= 0 ? 0.08 : Math.sqrt(v / 3);
  }

  private maxR(): number {
    return clamp((this.frame.h - 56) / 2, 20, 54);
  }

  private play(row: 0 | 1): void {
    this.mine = row;
    this.locked = true;
    this.revealed = false;
    this.since = 0;
    const g = BATTLE;
    if (this.mode === "together") this.theirs = this.env.rng.int(0, 1) as 0 | 1;
    else if (this.mode === "first") this.theirs = g.theirBest(row);
    else this.theirs = g.theyFirst().col;
    this.note.set("");
    this.youR.set(this.scale(0));
    this.theirR.set(this.scale(0));
    this.altR.set(0);
    this.sync();
  }

  private revealRound(): void {
    const row = this.mine!;
    const g = BATTLE;
    const pay = g.pay[row]![this.theirs]!;
    this.last = pay;
    this.youR.set(this.scale(pay[0]));
    this.theirR.set(this.scale(pay[1]));
    const other = (1 - row) as 0 | 1;
    const alt = this.mode === "first" ? g.pay[other]![g.theirBest(other)]![0] : g.pay[other]![this.theirs]![0];
    this.altR.set(this.scale(alt));
    this.revealed = true;
    const miss = pay[0] === 0;
    this.note.set(`${miss ? "You missed each other." : `You met at ${SPOT[row]}.`} You got ${pay[0]}. Going to ${SPOT[other]} would have paid ${alt}.`);
    this.announce(`${miss ? "You missed each other." : `You met at ${SPOT[row]}.`} You got ${pay[0]}.`);
    this.round++;
    this.locked = false;
    if (this.round >= 3) this.prompt.set("Same payoffs, three orders. What changed?");
    else this.roundPrompt();
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.seeStep = 0;
    this.bars.snap(1);
    this.afterStep();
  }

  private afterStep(): void {
    const texts = [
      ["Choosing at the same time is a guess.", "You average 1.5 if you pick A. Tap for the next order."],
      ["Move first and you commit. They work around you.", "Going to A first gets you 3. Tap again."],
      ["Move second and you react. You get what they leave.", "Same payoffs. The order changed the outcome."],
    ];
    this.bars.set(this.seeStep + 1);
    this.prompt.set(texts[this.seeStep]![0]!);
    this.note.set(texts[this.seeStep]![1]!);
    if (this.seeStep === 2) this.announce("Moving first lets you commit. Moving second lets you react.");
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.pi = 0;
    this.solved = 0;
    this.load();
  }

  private load(): void {
    this.locked2 = false;
    this.wrong = false;
    this.reveal.snap(0);
    this.prompt.set("You move first. Tap where play ends.");
    this.note.set("They see your move, then pick their best reply.");
    this.sync();
  }

  private answer(k: number): void {
    const g = this.games[this.pi]!;
    const want = g.youFirst();
    const ok = k >> 1 === want.row && (k & 1) === want.col;
    this.cue(ok ? "good" : "bad");
    if (ok) {
      this.locked2 = true;
      this.solved++;
      this.wrong = false;
      this.reveal.set(1);
      this.prompt.set("Right. You pick the row whose reply you like best.");
      this.note.set(`They answer ${want.row === 0 ? "Up" : "Down"} with ${want.col === 0 ? "Left" : "Right"}. You get ${want.pay[0]}.`);
      this.wait = 2.2;
    } else {
      this.wrong = true;
      this.reveal.set(0.5);
      this.prompt.set("Not quite. Work out their reply to each row.");
      this.note.set(`They answer Up with ${g.theirBest(0) === 0 ? "Left" : "Right"}, and Down with ${g.theirBest(1) === 0 ? "Left" : "Right"}.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.youR.step(dt);
    this.theirR.step(dt);
    this.altR.step(dt);
    this.bars.step(dt);
    this.reveal.step(dt);
    if (this.beat === "feel" && this.locked) {
      this.since += dt;
      if (this.since > 0.7 && !this.revealed) this.revealRound();
    }
    if (this.beat === "prove" && this.locked2 && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= 3) {
          this.prompt.set("Look ahead. Their reply decides what your move is worth.");
          this.note.set("Moving first lets you commit. Moving second lets you react.");
          this.finish();
        } else {
          this.pi++;
          this.load();
        }
        this.sync();
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    if (this.beat === "feel") this.drawFeel(p, c, f);
    else if (this.beat === "see") this.drawBars(p, c, f);
    else this.drawTable(p, c, f);
  }

  private drawFeel(p: Painter, c: Colors, f: Frame): void {
    const a = this.intro.value;
    const R = this.maxR();
    const cy = f.top + 12 + (f.h - 12 - (2 * R + 48)) / 2 + R;
    const off = Math.min(86, f.w / 2 - R - 10);
    const xl = this.cx - off;
    const xr = this.cx + off;
    const idle = this.locked && !this.revealed ? 0.5 + 0.5 * Math.sin(this.time * 9) : 1;
    p.text(LABEL[this.mode], this.cx, f.top + 12, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.dashedRing(xl, cy, R * this.altR.value, c.ink, 0.8);
    p.disc(xl, cy, R * this.youR.value, c.ink, 0.95 * a * idle);
    p.ring(xr, cy, R * this.theirR.value, c.ink, 1.5, a * idle);
    const ly = cy + R + 22;
    p.text("You", xl, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    p.text("They", xr, ly, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    if (this.revealed) {
      p.text(String(this.last[0]), xl, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
      p.text(String(this.last[1]), xr, ly + 22, { font: Type.mono(12), color: c.ink, align: "center" });
    }
    for (const i of [0, 1] as const) {
      const z = this.cells(2, i);
      const live = this.round < 3 && !this.locked;
      const chosen = this.locked && this.mine === i;
      const al = (live ? 1 : chosen ? 0.9 : this.round >= 3 ? 0 : 0.35) * a;
      p.frame(z.x, z.y, z.w, z.h, c.ink, 0.35 * al);
      p.rect(z.x, z.y, z.w, z.h, c.ink, this.armedZone === i ? 0.08 : 0);
      const gx = z.x + z.w / 2;
      p.ring(gx, z.y + z.h * 0.36, 13, c.ink, 1.5, al);
      p.text(SPOT[i], gx, z.y + z.h * 0.37, { font: Type.display(18), color: c.ink, align: "center", base: "middle", alpha: al });
      p.text(`Go to ${SPOT[i]}`, gx, z.y + z.h * 0.8, { font: Type.body(15, 400), color: c.ink, align: "center", alpha: al });
    }
    if (this.round < 3) this.ticks(p, c, 3, this.round, this.round);
  }

  private drawBars(p: Painter, c: Colors, f: Frame): void {
    const base = f.bottom - 30;
    const maxH = Math.max(60, f.h - 30 - 28);
    const spacing = Math.min(104, f.w * 0.3);
    const vals = [1.5, BATTLE.youFirst().pay[0], BATTLE.theyFirst().pay[0]];
    const names = ["same time", "you first", "they first"];
    p.rule(f.x + 10, base, f.x + f.w - 10, base, c.ink, 0.5);
    for (let i = 0; i < 3; i++) {
      const al = clamp(this.bars.value - i, 0, 1);
      const x = this.cx + (i - 1) * spacing;
      p.text(names[i]!, x, base + 22, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: al > 0.02 ? 1 : 0.35 });
      if (al < 0.02) continue;
      const h = (vals[i]! / 3) * maxH * al;
      p.rect(x - 17, base - h, 34, h, c.ink, 0.92);
      p.text(String(vals[i]), x, base - h - 10, { font: Type.mono(12), color: c.ink, align: "center", alpha: al });
    }
  }

  private drawTable(p: Painter, c: Colors, f: Frame): void {
    const mv = this.mv;
    const g = this.games[Math.min(this.pi, this.games.length - 1)]!;
    mv.grid(p, c, 1);
    const rows = ["Up", "Down"];
    const cols = ["Left", "Right"];
    ([0, 1] as const).forEach((i) => {
      p.text(rows[i]!, mv.x0 - 18, mv.rowY(i), { font: Type.body(15, 400), color: c.fog, align: "right", base: "middle" });
      p.text(cols[i]!, mv.colX(i), mv.y0 - 16, { font: Type.body(15, 400), color: c.fog, align: "center" });
    });
    p.disc(mv.x0 - mv.rowLabelW + 10, mv.y0 + mv.cell, 4, c.ink);
    p.ring(mv.x0 + mv.cell, mv.y0 - 46, 6, c.ink, 1.5);
    for (const r of [0, 1] as const) {
      for (const col of [0, 1] as const) {
        const [a1, b1] = g.pay[r]![col]!;
        const ctr = mv.center(r, col);
        p.disc(ctr.x, ctr.y - mv.cell * 0.1, mv.radius(a1, 9) * 0.82, c.ink, 0.92);
        p.text(`${a1},${b1}`, ctr.x, ctr.y + mv.cell * 0.4, { font: Type.mono(11), color: c.fog, align: "center" });
      }
    }
    const k = this.reveal.value;
    if (k > 0.02) {
      if (this.wrong) {
        for (const r of [0, 1] as const) {
          const ctr = mv.center(r, g.theirBest(r));
          p.dashedRing(ctr.x, ctr.y - mv.cell * 0.1, mv.cell * 0.34, c.ink, 0.9);
        }
      } else {
        const w = g.youFirst();
        const ctr = mv.center(w.row, w.col);
        p.ring(ctr.x, ctr.y - mv.cell * 0.1, mv.cell * 0.34, c.ink, 1.75, k);
      }
    }
    this.ticks(p, c, 3, this.solved, this.pi);
    void f;
  }
}
