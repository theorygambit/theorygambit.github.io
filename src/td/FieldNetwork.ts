import { Damped } from "../core/Damped";
import { FIELD, LEVEL, VERT } from "./shaders";

type RGB = [number, number, number];

function parse(color: string): RGB {
  const m = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * The background network. Two ping-pong render targets give the feedback
 * trails, and a final level pass maps them to the theme's two colours. The
 * pointer is eased like a Lag CHOP so the light drifts instead of snapping.
 */
export class FieldNetwork {
  private readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly field: WebGLProgram;
  private readonly level: WebGLProgram;
  private readonly quad: WebGLBuffer;
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private flip = 0;
  private w = 2;
  private h = 2;
  private raf = 0;
  private t0 = performance.now();
  private running = false;
  private ground: RGB = [0.03, 0.035, 0.04];
  private ink: RGB = [0.9, 0.89, 0.85];
  private readonly lx = new Damped(0.5, 0.9);
  private readonly ly = new Damped(0.75, 0.9);
  private readonly ro: ResizeObserver;
  private readonly still: boolean;

  static supported(): boolean {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL2 unavailable");
    this.gl = gl;
    this.field = this.program(VERT, FIELD);
    this.level = this.program(VERT, LEVEL);
    this.quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    this.resize();
  }

  private program(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    return p;
  }

  setColors(ground: string, ink: string): void {
    this.ground = parse(ground);
    this.ink = parse(ink);
  }

  private resize(): void {
    const gl = this.gl;
    // Decorative, so a quarter of the pixels is plenty and softness is welcome.
    const scale = 0.4;
    const w = Math.max(2, Math.round(this.canvas.clientWidth * scale));
    const h = Math.max(2, Math.round(this.canvas.clientHeight * scale));
    if (w === this.w && h === this.h && this.tex.length) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.tex.forEach((t) => gl.deleteTexture(t));
    this.fbo.forEach((f) => gl.deleteFramebuffer(f));
    this.tex = [];
    this.fbo = [];
    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.tex.push(tex);
      this.fbo.push(fbo);
    }
    this.draw(0);
  }

  private readonly onPointer = (e: PointerEvent): void => {
    this.lx.set(e.clientX / Math.max(1, window.innerWidth));
    this.ly.set(1 - e.clientY / Math.max(1, window.innerHeight));
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.lx.step(dt);
      this.ly.step(dt);
      this.draw((now - this.t0) / 1000);
      this.raf = this.still ? 0 : requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private draw(t: number): void {
    const gl = this.gl;
    const src = this.flip;
    const dst = 1 - this.flip;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[dst]!);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.field);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[src]!);
    gl.uniform1i(gl.getUniformLocation(this.field, "prev"), 0);
    gl.uniform2f(gl.getUniformLocation(this.field, "res"), this.w, this.h);
    gl.uniform1f(gl.getUniformLocation(this.field, "t"), t);
    gl.uniform2f(gl.getUniformLocation(this.field, "light"), this.lx.value, this.ly.value);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.level);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[dst]!);
    gl.uniform1i(gl.getUniformLocation(this.level, "tex"), 0);
    gl.uniform3f(gl.getUniformLocation(this.level, "ground"), ...this.ground);
    gl.uniform3f(gl.getUniformLocation(this.level, "ink"), ...this.ink);
    gl.uniform1f(gl.getUniformLocation(this.level, "amount"), 0.16);
    gl.uniform1f(gl.getUniformLocation(this.level, "seed"), Math.floor(t * 12) % 64);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.flip = dst;
  }

  dispose(): void {
    this.stop();
    this.ro.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
