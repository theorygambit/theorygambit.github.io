import { Damped } from "../core/Damped";
import { Painter, Type } from "../core/Painter";
import { Palette } from "../core/Palette";
import { Surface } from "../core/Surface";

/**
 * The home hero: the Tidal Halo mark and the wordmark. Everything, including
 * the text, is drawn in this 1:1 canvas, never as page text floating above it.
 */
export class HeroRenderer {
  private readonly surface: Surface;
  private readonly painter: Painter;
  private readonly box: HTMLElement;
  private readonly ro: ResizeObserver;
  private readonly px = new Damped(0, 0.8);
  private readonly py = new Damped(0, 0.8);
  private raf = 0;
  private visible = true;
  private readonly io: IntersectionObserver;
  private last = performance.now();
  private t = 0;

  constructor(canvas: HTMLCanvasElement, box: HTMLElement) {
    this.surface = new Surface(canvas, true);
    this.painter = new Painter(this.surface);
    this.box = box;
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(box);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
    });
    this.io.observe(box);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    this.fit();
    this.raf = requestAnimationFrame(this.loop);
  }

  private fit(): void {
    this.surface.fit(this.box.clientWidth, this.box.clientHeight);
  }

  private readonly onPointer = (e: PointerEvent): void => {
    this.px.set((e.clientX / Math.max(1, window.innerWidth) - 0.5) * 10);
    this.py.set((e.clientY / Math.max(1, window.innerHeight) - 0.5) * 6);
  };

  private readonly loop = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.visible && !document.hidden) {
      this.t += dt;
      this.px.step(dt);
      this.py.step(dt);
      this.draw();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(): void {
    const p = this.painter;
    const c = Palette.colors;
    const { w, h } = this.surface;
    p.ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = 92;
    const radii = [14, 28, 44, 62, 82];
    radii.forEach((r, i) => {
      const k = i / (radii.length - 1);
      const breathe = 1 + 0.012 * Math.sin(this.t * 0.6 + i * 0.9);
      const x = cx + this.px.value * (0.3 + k);
      const y = cy + this.py.value * (0.3 + k);
      const gap = this.t * (0.12 + 0.05 * i) * (i % 2 ? -1 : 1);
      p.arc(x, y, r * breathe, gap + 0.28, gap + Math.PI * 2 - 0.28, c.ink, 1.25, 0.95 - k * 0.55);
    });
    p.disc(cx + this.px.value * 0.3, cy + this.py.value * 0.3, 3, c.ink);
    p.text("Theory Gambit", cx, 196, { font: Type.display(40), color: c.ink, align: "center" });
    p.text("Learn game theory by playing it.", cx, 222, { font: Type.body(15, 300), color: c.fog, align: "center" });
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
  }
}
