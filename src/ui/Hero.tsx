import { useEffect, useRef } from "react";
import { HeroRenderer } from "./HeroRenderer";

export function Hero() {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!box.current || !canvas.current) return;
    const r = new HeroRenderer(canvas.current, box.current);
    return () => r.dispose();
  }, []);
  return (
    <div className="hero" ref={box}>
      <h1 className="sr">Theory Gambit. Learn game theory by playing it.</h1>
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
