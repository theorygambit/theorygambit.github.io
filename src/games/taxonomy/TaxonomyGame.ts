import { CanvasButton } from "../../core/CanvasButton";
import { Damped } from "../../core/Damped";
import { Game, type Beat, type Frame } from "../../core/Game";
import type { Box } from "../../core/Geometry";
import type { Colors } from "../../core/Palette";
import { Type, type Painter } from "../../core/Painter";
import { FEEL_SCENES, proveScenes, quadrantOf, type Scene } from "./model";

const COLS = ["At once", "In turns"];
const ROWS = ["Zero-sum", "Not zero-sum"];
const READ = [
  "Zero-sum, at once. Guessing duels.",
  "Zero-sum, in turns. Contests you can plan ahead.",
  "Not zero-sum, at once. Everyone guesses and can gain.",
  "Not zero-sum, in turns. Deals built move by move.",
];

/**
 * Feel: four situations. Tap the corner of the map where each belongs: do they choose at once or in turns,
 * and is the pie fixed or not?
 * See: the finished map. Tap each corner to read what lives there.
 * Prove: three new situations to place.
 */
export class TaxonomyGame extends Game {
  readonly slug = "taxonomy";
  private idx = 0;
  private stage: "ask" | "done" = "ask";
  private placed: { scene: Scene; q: number }[] = [];
  private wrongQ = -1;
  private readonly intro = new Damped(0, 0.7);
  private readonly pop = new Damped(0, 0.4);

  private readonly read = new Set<number>();
  private lastRead = -1;

  private scenes: Scene[] = [];
  private pi = 0;
  private solved = 0;
  private locked = false;
  private wait = 0;

  private readonly next = this.add(new CanvasButton("Next", () => this.nextScene(), "primary"));
  private readonly toSee = this.add(new CanvasButton("See why", () => this.enterSee(), "primary"));
  private readonly toProve = this.add(new CanvasButton("Try it", () => this.enterProve(), "primary"));

  begin(): void {
    this.idx = 0;
    this.stage = "ask";
    this.placed = [];
    this.wrongQ = -1;
    this.read.clear();
    this.lastRead = -1;
    this.scenes = proveScenes(this.env.rng);
    this.pi = 0;
    this.solved = 0;
    this.intro.snap(0).set(1);
    this.pop.snap(1);
    this.setBeat("feel");
    this.ask();
    this.sync();
  }

  private ask(): void {
    this.stage = "ask";
    this.wrongQ = -1;
    this.pop.snap(0).set(1);
    this.prompt.set(`Where does ${FEEL_SCENES[this.idx]!.name} belong?`);
    this.note.set("Do they choose at once or in turns? Is the pie fixed?");
  }

  debugGoto(beat: Beat): void {
    this.begin();
    if (beat === "feel") return;
    this.placed = FEEL_SCENES.map((s) => ({ scene: s, q: quadrantOf(s) }));
    this.idx = FEEL_SCENES.length;
    this.enterSee();
    this.read.add(0).add(1).add(2).add(3);
    this.lastRead = 3;
    this.afterRead();
    if (beat === "prove") this.enterProve();
  }

  protected layout(): void {
    const by = this.buttonY;
    for (const b of [this.next, this.toSee, this.toProve]) b.place(this.cx - 80, by, 160);
  }

  private sync(): void {
    const feelDone = this.beat === "feel" && this.stage === "done";
    this.next.visible = feelDone && this.idx < FEEL_SCENES.length - 1;
    this.toSee.visible = feelDone && this.idx >= FEEL_SCENES.length - 1;
    this.toProve.visible = this.beat === "see" && this.read.size === 4;
  }

  private map(f: Frame): { x0: number; y0: number; qw: number; qh: number } {
    const x0 = f.x + 90;
    const w = f.w - 90;
    return { x0, y0: f.top + 28, qw: w / 2, qh: Math.max(40, (f.h - 32) / 2) };
  }

  private quad(i: number): Box {
    const m = this.map(this.frame);
    return { x: m.x0 + (i & 1) * m.qw, y: m.y0 + (i >> 1) * m.qh, w: m.qw, h: m.qh };
  }

  protected override zonesActive(): Box[] | null {
    const ok = (this.beat === "feel" && this.stage === "ask") || this.beat === "see" || (this.beat === "prove" && !this.locked);
    return ok ? [0, 1, 2, 3].map((i) => this.quad(i)) : null;
  }

  protected override onZone(i: number): void {
    if (this.beat === "feel") this.answerFeel(i);
    else if (this.beat === "see") this.readQuad(i);
    else this.answerProve(i);
  }

  // ---- Feel -------------------------------------------------------------

  private answerFeel(i: number): void {
    const s = FEEL_SCENES[this.idx]!;
    const q = quadrantOf(s);
    this.cue(i === q ? "good" : "bad");
    this.wrongQ = i === q ? -1 : i;
    this.placed.push({ scene: s, q });
    this.pop.snap(0).set(1);
    this.stage = "done";
    this.prompt.set(i === q ? "Right." : "Not there. It belongs here.");
    this.note.set(s.why);
    this.announce(`${s.name}: ${s.why}`);
    this.sync();
  }

  private nextScene(): void {
    this.idx++;
    this.ask();
    this.sync();
  }

  // ---- See --------------------------------------------------------------

  private enterSee(): void {
    this.setBeat("see");
    this.read.clear();
    this.lastRead = -1;
    this.prompt.set("Tap each corner of the map.");
    this.note.set("Two questions place any game: timing and sum.");
    this.sync();
  }

  private readQuad(i: number): void {
    this.read.add(i);
    this.lastRead = i;
    this.afterRead();
  }

  private afterRead(): void {
    this.note.set(READ[this.lastRead]!);
    if (this.read.size === 4) {
      this.prompt.set("Two questions place any game: timing and sum.");
      this.announce("The map has four corners: zero-sum or not, at once or in turns.");
    }
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
    this.locked = false;
    this.wrongQ = -1;
    this.placed = [];
    this.pop.snap(0).set(1);
    this.prompt.set(`Where does ${this.scenes[this.pi]!.name} belong?`);
    this.note.set("Place it on the map.");
    this.sync();
  }

  private answerProve(i: number): void {
    const s = this.scenes[this.pi]!;
    const q = quadrantOf(s);
    this.cue(i === q ? "good" : "bad");
    if (i === q) {
      this.locked = true;
      this.solved++;
      this.wrongQ = -1;
      this.placed = [{ scene: s, q }];
      this.pop.snap(0).set(1);
      this.prompt.set("Right.");
      this.note.set(s.why);
      this.wait = 2.4;
    } else {
      this.wrongQ = i;
      this.prompt.set("Not there. Think timing, then sum.");
      this.note.set(`${COLS[i & 1]}, ${ROWS[i >> 1]!.toLowerCase()}? Check who sees what, and who gains.`);
    }
  }

  // ---- Loop -------------------------------------------------------------

  protected tick(dt: number): void {
    this.intro.step(dt);
    this.pop.step(dt);
    if (this.beat === "prove" && this.locked && this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.solved >= this.scenes.length) {
          this.prompt.set("Timing and sum place any game on the map.");
          this.note.set("Place the situation first, then pick the tool.");
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
    const m = this.map(f);
    const a = this.intro.value;
    for (let i = 0; i < 2; i++) p.text(COLS[i]!, m.x0 + m.qw * (i + 0.5), f.top + 14, { font: Type.body(13, 400), color: c.fog, align: "center", alpha: a });
    for (let i = 0; i < 2; i++) p.text(ROWS[i]!, m.x0 - 12, m.y0 + m.qh * (i + 0.5), { font: Type.body(13, 400), color: c.fog, align: "right", base: "middle", alpha: a });
    p.frame(m.x0, m.y0, m.qw * 2, m.qh * 2, c.ink, 0.3 * a);
    p.rule(m.x0 + m.qw, m.y0, m.x0 + m.qw, m.y0 + m.qh * 2, c.ink, 0.3 * a);
    p.rule(m.x0, m.y0 + m.qh, m.x0 + m.qw * 2, m.y0 + m.qh, c.ink, 0.3 * a);
    for (let i = 0; i < 4; i++) {
      const b = this.quad(i);
      if (this.armedZone === i) p.rect(b.x, b.y, b.w, b.h, c.ink, 0.08);
    }
    const counts = [0, 0, 0, 0];
    for (const pl of this.placed) {
      const b = this.quad(pl.q);
      const k = counts[pl.q]!++;
      const cx = b.x + b.w / 2;
      void k;
      const cy = b.y + b.h * 0.4;
      const al = 1;
      p.disc(cx, cy, 6 * (this.beat === "see" ? 1 : Math.max(0.01, this.pop.value)), c.ink, al);
      p.text(pl.scene.name, cx, cy + 24, { font: Type.body(12, 400), color: c.fog, align: "center", alpha: al });
    }
    if (this.wrongQ >= 0) {
      const b = this.quad(this.wrongQ);
      p.dashedRing(b.x + b.w / 2, b.y + b.h * 0.4, 14, c.ink, 0.7);
    }
    if (this.beat === "see" && this.lastRead >= 0) {
      const b = this.quad(this.lastRead);
      p.frame(b.x + 3, b.y + 3, b.w - 6, b.h - 6, c.ink, 0.7);
    }
    if (this.beat === "feel") this.ticks(p, c, FEEL_SCENES.length, this.idx + (this.stage === "done" ? 1 : 0), this.idx);
    if (this.beat === "prove") this.ticks(p, c, this.scenes.length, this.solved, this.pi);
  }
}
