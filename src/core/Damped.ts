/**
 * Critically damped smoothing. The brand says motion is a whisper: nothing
 * bounces and nothing snaps, so every moving value in a game chases its target
 * through one of these instead of being tweened with an overshooting curve.
 */
export class Damped {
  value: number;
  target: number;
  private velocity = 0;
  smooth: number;

  constructor(value = 0, smooth = 0.28) {
    this.value = value;
    this.target = value;
    this.smooth = smooth;
  }

  set(target: number): this {
    this.target = target;
    return this;
  }

  snap(value: number): this {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    return this;
  }

  step(dt: number): number {
    const omega = 2 / Math.max(0.0001, this.smooth);
    const x = omega * dt;
    const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const change = this.value - this.target;
    const temp = (this.velocity + omega * change) * dt;
    this.velocity = (this.velocity - omega * temp) * k;
    this.value = this.target + (change + temp) * k;
    if (Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-4) {
      this.value = this.target;
      this.velocity = 0;
    }
    return this.value;
  }

  get settled(): boolean {
    return this.value === this.target;
  }
}

/** A set of named Damped values stepped together, like a bank of Lag CHOPs. */
export class Signals {
  private ch = new Map<string, Damped>();

  define(name: string, initial: number, smooth: number): this {
    this.ch.set(name, new Damped(initial, smooth));
    return this;
  }

  set(name: string, target: number): void {
    this.ch.get(name)?.set(target);
  }

  snap(name: string, value: number): void {
    this.ch.get(name)?.snap(value);
  }

  get(name: string): number {
    return this.ch.get(name)?.value ?? 0;
  }

  step(dt: number): void {
    for (const c of this.ch.values()) c.step(dt);
  }
}
