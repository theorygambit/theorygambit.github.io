import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { inside } from "../shared/MatrixView";
import { drawChoice, drawTicks, fmt } from "../shared/kit";
import { Deterrence, FEEL_CASES, PROVE_CASES } from "./model";

type Pick = "threat" | "commit";

interface View {
  /** The accommodate branch has been cut. */
  cut: boolean;
  /** Which branches were taken: out, accommodate or fight. */
  path: "out" | "acc" | "fight" | null;
  /** Mark your best reply at the incumbent node. */
  reply: boolean;
}

/**
 * Feel: you are the incumbent. A rival may enter. Threaten to fight for free, or commit to it at a cost.
 * See: backward induction on the first case. The threat fails, and the commitment cuts the branch that makes it fail.
 * Prove: three new cases. Commit, or not.
 */
export class CommitmentCredibilityGame extends Game {
  readonly slug = "commitment-credibility";
  private picks: Pick[] = [];
  private round = 0;
  private waiting = false;
  private since = 0;
  private armed: Pick | null = null;
  private view: View = { cut: false, path: null, reply: false };
  private readonly shade = new Damped(0, 0.4);

  private phase = 0;
  private readonly seeFade = new Damped(0, 0.5);

  private cases: Deterrence[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;
  private wrong: Pick | null = null;

  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.picks = [];
    this.round = 0;
    this.waiting = false;
    this.view = { cut: false, path: null, reply: false };
    this.shade.snap(0);
    this.phase = 0;
    this.seeFade.snap(0);
    this.solved = 0;
    this.setBeat("feel");
    this.loadCase();
    this.sync();
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.picks = ["threat", "commit", "commit"];
    this.round = 3;
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
    this.toSee.visible = this.beat === "feel" && this.round >= 3 && !this.waiting;
    this.toProve.visible = this.beat === "see" && this.phase >= 3;
  }

  // ---- Input ------------------------------------------------------------

  protected override onDown(x: number, y: number): void {
    const live = (this.beat === "feel" && !this.waiting && this.round < 3) || (this.beat === "prove" && !this.locked);
    if (live) {
      if (inside(this.pair(0), x, y)) this.armed = "threat";
      else if (inside(this.pair(1), x, y)) this.armed = "commit";
    } else if (this.beat === "see") this.advance();
  }

  protected override onUp(x: number, y: number): void {
    const a = this.armed;
    this.armed = null;
    if (!a || !inside(this.pair(a === "threat" ? 0 : 1), x, y)) return;
    if (this.beat === "feel") this.play(a);
    else if (this.beat === "prove" && !this.locked) this.answer(a);
  }

  // ---- Feel -------------------------------------------------------------

  private loadCase(): void {
    this.view = { cut: false, path: null, reply: false };
    this.shade.snap(0);
    this.prompt.set(this.round === 0 ? "A rival may enter. Say you will fight, or commit to it." : "Another rival. Threaten, or commit?");
    const d = FEEL_CASES[this.round]!;
    this.note.set(`Committing costs ${fmt(d.k)} and removes your option to accommodate.`);
  }

  private play(a: Pick): void {
    const d = FEEL_CASES[this.round]!;
    const committed = a === "commit";
    const o = d.outcome(committed);
    const other = d.outcome(!committed);
    this.picks.push(a);
    this.waiting = true;
    this.since = 0;
    this.view = { cut: committed, path: !o.enters ? "out" : o.fights ? "fight" : "acc", reply: false };
    this.shade.set(1);
    this.cue(o.incumbent >= other.incumbent ? "good" : "bad");
    this.prompt.set(o.enters ? (o.fights ? "They came in, and you fought." : "They came in, and you made room.") : "They stayed out.");
    this.note.set(`You got ${fmt(o.incumbent)}. The other choice: ${fmt(other.incumbent)}.`);
    this.announce(`Rival ${this.round + 1}. ${o.enters ? "They entered." : "They stayed out."} You got ${fmt(o.incumbent)}. The other choice gave ${fmt(other.incumbent)}.`);
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.phase = 0;
    this.view = { cut: false, path: null, reply: false };
    this.prompt.set("You are the disc. They are the ring.");
    this.note.set("Tap to work backwards from the end.");
    this.sync();
  }

  private advance(): void {
    if (this.phase >= 3) return;
    this.phase++;
    const d = FEEL_CASES[0]!;
    if (this.phase === 1) {
      this.view = { cut: false, path: null, reply: true };
      this.prompt.set(`If they enter, you accommodate: ${fmt(d.acc[1])} beats ${fmt(d.fight[1])}.`);
      this.note.set("So your threat to fight is empty.");
    } else if (this.phase === 2) {
      this.view = { cut: false, path: "acc", reply: true };
      this.prompt.set("They see that, and they come in.");
      this.note.set(`They get ${fmt(d.acc[0])} against ${fmt(d.out[0])} for staying out.`);
    } else {
      this.view = { cut: true, path: "out", reply: false };
      this.prompt.set("Commit, and the easy way out is gone.");
      this.note.set(`Now fighting is all you have, so they stay out. You get ${fmt(d.out[1] - d.k)}.`);
      this.announce("Committing removes the option to accommodate. The threat is believed and they stay out.");
    }
    this.sync();
  }

  // ---- Prove ------------------------------------------------------------

  private enterProve(): void {
    this.setBeat("prove");
    this.cases = this.env.rng.shuffle(PROVE_CASES);
    this.pi = 0;
    this.solved = 0;
    this.loadProve();
    this.sync();
  }

  private loadProve(): void {
    const d = this.cases[this.pi]!;
    this.locked = false;
    this.wrong = null;
    this.view = { cut: false, path: null, reply: false };
    this.prompt.set(this.pi === 0 ? "A new case. Commit, or not?" : "Another case. Commit, or not?");
    this.note.set(`Committing costs ${fmt(d.k)}.`);
  }

  private answer(a: Pick): void {
    const d = this.cases[this.pi]!;
    const right: Pick = d.commitPays ? "commit" : "threat";
    if (a === right) {
      this.cue("good");
      this.locked = true;
      this.solved++;
      this.wrong = null;
      const free = d.outcome(false);
      const paid = d.outcome(true);
      this.view = { cut: d.commitPays, path: (d.commitPays ? paid : free).enters ? ((d.commitPays ? paid : free).fights ? "fight" : "acc") : "out", reply: false };
      if (d.commitPays) {
        this.prompt.set("Right. The threat is empty, and the commitment pays.");
        this.note.set(`Without it you get ${fmt(free.incumbent)}. With it ${fmt(paid.incumbent)}.`);
      } else if (d.credible) {
        this.prompt.set("Right. They already believe you.");
        this.note.set(`Fighting beats accommodating for you, so committing only costs ${fmt(d.k)}.`);
      } else {
        this.prompt.set("Right. Not worth the price.");
        this.note.set(`Committing gives ${fmt(paid.incumbent)}, less than the ${fmt(free.incumbent)} you get anyway.`);
      }
      this.wait = 2.6;
    } else {
      this.cue("bad");
      this.wrong = a;
      this.prompt.set("Not quite. Would you really fight? Then compare.");
      this.note.set(`Fight ${fmt(d.fight[1])}, accommodate ${fmt(d.acc[1])}. Committing costs ${fmt(d.k)}.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.shade.step(dt);
    this.seeFade.step(dt);
    if (this.beat === "feel" && this.waiting) {
      this.since += dt;
      if (this.since > 2) {
        this.waiting = false;
        this.round++;
        if (this.round < 3) this.loadCase();
        else {
          this.prompt.set("Three rivals. When did the threat work?");
          this.note.set("");
        }
        this.sync();
      }
    }
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.cases.length) {
          this.prompt.set("Binding yourself can make you stronger.");
          this.note.set("A threat is believed only when carrying it out is what you would want to do.");
          this.finish();
        } else {
          this.pi++;
          this.loadProve();
        }
      }
    }
  }

  // ---- Draw -------------------------------------------------------------

  protected render(p: Painter, c: Colors, f: Frame): void {
    const d = this.beat === "see" ? FEEL_CASES[0]! : this.beat === "feel" ? FEEL_CASES[Math.min(this.round, 2)]! : this.cases[Math.min(this.pi, this.cases.length - 1)]!;
    this.tree(p, c, f, d, this.view);
    if (this.beat === "see") {
      drawTicks(p, c, f, this.cx, 4, this.phase + 1, this.phase);
      return;
    }
    const prove = this.beat === "prove";
    if (prove || this.round < 3) {
      for (const i of [0, 1] as const) {
        const a: Pick = i === 0 ? "threat" : "commit";
        const right: Pick = d.commitPays ? "commit" : "threat";
        const al = prove ? (this.wrong === a ? 0.35 : this.locked && a !== right ? 0.3 : 1) : this.waiting ? (this.picks[this.round] === a ? 0.9 : 0.3) : 1;
        drawChoice(p, c, this.pair(i), { label: a === "threat" ? "Threaten" : "Commit", sub: a === "threat" ? "free" : `costs ${fmt(d.k)}`, r: a === "threat" ? 8 : 14, alpha: al, armed: this.armed === a });
      }
    }
    if (prove) drawTicks(p, c, f, this.cx, this.cases.length, this.solved, this.pi);
    else drawTicks(p, c, f, this.cx, 3, this.round, Math.min(this.round, 2));
  }

  private tree(p: Painter, c: Colors, f: Frame, d: Deterrence, v: View): void {
    const w = f.w;
    const root = { x: f.x + w * 0.3, y: f.top + 14 };
    const inc = { x: f.x + w * 0.68, y: f.top + f.h * 0.4 };
    const y3 = f.top + f.h * 0.68;
    const out = { x: f.x + w * 0.12, y: y3 };
    const acc = { x: f.x + w * 0.52, y: y3 };
    const fight = { x: f.x + w * 0.88, y: y3 };
    const taken = (k: "out" | "acc" | "fight") => v.path === k;
    const inPath = v.path === "acc" || v.path === "fight";
    const seg = (a: { x: number; y: number }, b: { x: number; y: number }, on: boolean, faint = false) => p.line(a.x, a.y, b.x, b.y, c.ink, on ? 2.5 : 1, faint ? 0.25 : on ? 1 : 0.5, faint ? [3, 4] : undefined);
    seg(root, out, taken("out"));
    seg(root, inc, inPath);
    seg(inc, acc, taken("acc") || (v.reply && v.path === null), v.cut);
    seg(inc, fight, taken("fight"), v.reply && !v.cut && v.path !== "fight");
    p.ring(root.x, root.y, 6, c.ink, 1.5);
    p.disc(inc.x, inc.y, 6, c.ink);
    const r = (x: number) => 10 * Math.sqrt(Math.max(0, x) / 8);
    const leaf = (pt: { x: number; y: number }, pay: readonly [number, number], word: string, faint: boolean) => {
      const a = faint ? 0.3 : 1;
      if (pay[0] > 0) p.ring(pt.x - 12, pt.y, r(pay[0]), c.ink, 1.5, a);
      if (pay[1] > 0) p.disc(pt.x + 12, pt.y, r(pay[1]), c.ink, 0.92 * a);
      p.text(`${fmt(pay[0])}, ${fmt(pay[1])}`, pt.x, pt.y + 24, { font: Type.mono(10), color: c.ink, align: "center", alpha: a });
      p.text(word, pt.x, pt.y + 38, { font: Type.body(10, 400), color: c.fog, align: "center", alpha: a });
    };
    leaf(out, [d.out[0], d.out[1] - (v.cut ? d.k : 0)], "stays out", false);
    leaf(acc, d.acc, "accommodate", v.cut);
    leaf(fight, [d.fight[0], d.fight[1] - (v.cut ? d.k : 0)], "fight", false);
  }
}
