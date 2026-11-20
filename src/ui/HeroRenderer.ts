import { HeroScene, type RGB } from "./heroScene";

/**
 * The home hero. The scene (heroScene.ts, shared with the promo banner) is a small physics
 * simulation; this class owns the canvas, the clock and the touch.
 *
 * Touch: a press sends a ripple and the thread circles your fingertip; holding draws everything
 * closer; release lets it unwind. Mouse hover is a lighter version of the same. Vertical swipes
 * still scroll the page (touch-action: pan-y), which ends the touch cleanly.
 * Reduced motion: the finished frame, still. A tap redraws it once with the ripple frozen out.
 */
export class HeroRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly box: HTMLElement;
  private readonly scene: HeroScene;
  private readonly ro: ResizeObserver;
  private readonly io: IntersectionObserver;
  private readonly still: boolean;
  private raf = 0;
  private visible = true;
  private last = performance.now();

  constructor(canvas: HTMLCanvasElement, box: HTMLElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.canvas = canvas;
    this.ctx = ctx;
    this.box = box;
    this.still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const { ink, ground } = this.colors();
    this.scene = new HeroScene({ ink, ground });
    canvas.style.touchAction = "pan-y";
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(box);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0]?.isIntersecting ?? true;
    });
    this.io.observe(box);
    box.addEventListener("pointerdown", this.onDown);
    box.addEventListener("pointermove", this.onMove);
    box.addEventListener("pointerup", this.onUp);
    box.addEventListener("pointercancel", this.onLeave);
    box.addEventListener("pointerleave", this.onLeave);
    this.fit();
    if (this.still) {
      for (let i = 0; i < 60 * 6; i++) this.scene.step(1 / 60);
      this.draw();
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  private colors(): { ink: RGB; ground: string } {
    const cs = getComputedStyle(document.documentElement);
    const ground = cs.getPropertyValue("--c-ground").trim() || "#08090b";
    const ink = parseColor(cs.getPropertyValue("--c-ink").trim()) ?? (document.documentElement.dataset.theme === "light" ? [8, 9, 11] : [230, 227, 218]);
    return { ink, ground };
  }

  private fit(): void {
    // Two device pixels per css pixel is plenty for hairlines and keeps 3x phones cool.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, this.box.clientWidth);
    const h = Math.max(1, this.box.clientHeight);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scene.resize(w, h, dpr);
    this.draw();
  }

  private pos(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private readonly onDown = (e: PointerEvent): void => {
    const [x, y] = this.pos(e);
    this.scene.press(x, y);
    if (this.still) this.draw();
  };
  private readonly onMove = (e: PointerEvent): void => {
    const [x, y] = this.pos(e);
    this.scene.pointer(x, y, e.pointerType === "mouse" ? e.buttons > 0 : true);
  };
  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerType === "mouse") {
      const [x, y] = this.pos(e);
      this.scene.pointer(x, y, false);
    } else this.scene.pointer(null);
  };
  private readonly onLeave = (): void => this.scene.pointer(null);

  private readonly loop = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.visible && !document.hidden && !this.still) {
      const { ink, ground } = this.colors();
      this.scene.setColors(ink, ground);
      this.scene.step(dt);
      this.draw();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private draw(): void {
    this.scene.draw(this.ctx);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.io.disconnect();
    for (const [n, f] of [["pointerdown", this.onDown], ["pointermove", this.onMove], ["pointerup", this.onUp], ["pointercancel", this.onLeave], ["pointerleave", this.onLeave]] as const) {
      this.box.removeEventListener(n, f as EventListener);
    }
  }
}

function parseColor(v: string): RGB | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(v);
  return m ? [+m[1]!, +m[2]!, +m[3]!] : null;
}
