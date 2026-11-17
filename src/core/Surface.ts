/**
 * A gameplay canvas that is exactly 1:1 with device pixels.
 * canvas.width equals css width times devicePixelRatio, and the css size is then
 * derived back from the backing store, so the browser never resamples it.
 * Soft canvases are only allowed for decorative backgrounds.
 */
export class Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  dpr = 1;
  /** CSS size of the drawing area. Always equals canvas.width / dpr. */
  w = 0;
  h = 0;

  constructor(canvas: HTMLCanvasElement, alpha = false) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha });
    if (!ctx) throw new Error("Canvas 2D is unavailable");
    this.ctx = ctx;
  }

  /** Fit to a box measured in css pixels. Returns true when the backing store changed. */
  fit(boxW: number, boxH: number): boolean {
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.max(1, Math.floor(boxW * dpr));
    const ph = Math.max(1, Math.floor(boxH * dpr));
    const changed = pw !== this.canvas.width || ph !== this.canvas.height || dpr !== this.dpr;
    if (changed) {
      this.dpr = dpr;
      this.canvas.width = pw;
      this.canvas.height = ph;
      this.canvas.style.width = `${pw / dpr}px`;
      this.canvas.style.height = `${ph / dpr}px`;
    }
    this.w = pw / dpr;
    this.h = ph / dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return changed;
  }
}
