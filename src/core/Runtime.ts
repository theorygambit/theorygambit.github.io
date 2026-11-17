import { EventBus } from "./EventBus";
import type { Game, GameEvents } from "./Game";
import { Painter } from "./Painter";
import { Palette } from "./Palette";
import { GameRegistry } from "./Registry";
import { Rng } from "./Rng";
import { Surface } from "./Surface";
import { loadFonts } from "./Fonts";

/**
 * Hosts one Game on one canvas: sizing, the frame loop, theme redraws and the
 * pointer. Only the first pointer steers, so a second finger never fights the first.
 */
export class GameRuntime {
  readonly bus = new EventBus<GameEvents>();
  private readonly surface: Surface;
  private readonly painter: Painter;
  private readonly box: HTMLElement;
  private readonly slug: string;
  private game: Game | null = null;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private activeId: number | null = null;
  private disposed = false;
  private readonly ro: ResizeObserver;
  private readonly offPalette: () => void;

  constructor(canvas: HTMLCanvasElement, box: HTMLElement, slug: string) {
    this.surface = new Surface(canvas);
    this.painter = new Painter(this.surface);
    this.box = box;
    this.slug = slug;
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(box);
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.up);
    document.addEventListener("visibilitychange", this.visibility);
    this.offPalette = Palette.bus.on("change", () => this.paintOnce());
    this.fit();
    void this.boot();
  }

  private async boot(): Promise<void> {
    await loadFonts();
    if (this.disposed) return;
    this.restart();
    this.loop(performance.now());
  }

  /** A fresh seeded run. Used by the first start and by the Restart button. */
  restart(): void {
    const module = GameRegistry.get(this.slug);
    if (!module) return;
    this.game?.dispose();
    const game = module.create({ rng: Rng.fresh(), bus: this.bus });
    this.game = game;
    game.begin();
    game.resize(this.surface.w, this.surface.h);
    this.bus.emit("beat", "feel");
    if (new URLSearchParams(location.search).has("debug")) (window as unknown as { __tg?: unknown }).__tg = { game, runtime: this };
  }

  private fit(): void {
    const w = this.box.clientWidth;
    const h = this.box.clientHeight;
    if (w < 2 || h < 2) return;
    if (this.surface.fit(w, h)) this.game?.resize(this.surface.w, this.surface.h);
    this.paintOnce();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.surface.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readonly down = (e: PointerEvent): void => {
    if (this.activeId !== null) return;
    this.activeId = e.pointerId;
    this.surface.canvas.setPointerCapture?.(e.pointerId);
    const { x, y } = this.local(e);
    this.game?.pointerDown(x, y);
  };

  private readonly move = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    const { x, y } = this.local(e);
    this.game?.pointerMove(x, y);
  };

  private readonly up = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    const { x, y } = this.local(e);
    this.game?.pointerUp(x, y);
  };

  private readonly visibility = (): void => {
    if (document.hidden) cancelAnimationFrame(this.raf);
    else if (!this.disposed) {
      this.last = performance.now();
      this.loop(this.last);
    }
  };

  private readonly loop = (now: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.acc += dt;
    const fixed = 1 / 60;
    let n = 0;
    while (this.acc >= fixed && n < 4) {
      this.game?.step(fixed);
      this.acc -= fixed;
      n++;
    }
    this.paintOnce();
    this.raf = requestAnimationFrame(this.loop);
  };

  private paintOnce(): void {
    if (!this.game || this.surface.w < 2) return;
    const c = Palette.colors;
    this.painter.clear(c);
    this.game.draw(this.painter, c);
  }

  debug(): Game | null {
    return this.game;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.offPalette();
    const canvas = this.surface.canvas;
    canvas.removeEventListener("pointerdown", this.down);
    canvas.removeEventListener("pointermove", this.move);
    canvas.removeEventListener("pointerup", this.up);
    canvas.removeEventListener("pointercancel", this.up);
    document.removeEventListener("visibilitychange", this.visibility);
    this.game?.dispose();
  }
}
