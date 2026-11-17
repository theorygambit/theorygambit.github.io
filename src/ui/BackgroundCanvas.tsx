import { useEffect, useRef } from "react";
import { Palette } from "../core/Palette";
import { FieldNetwork } from "../td/FieldNetwork";

/** The soft decorative field. Paused whenever a game is on screen, to save battery. */
export function BackgroundCanvas({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const net = useRef<FieldNetwork | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !FieldNetwork.supported()) return;
    let network: FieldNetwork;
    try {
      network = new FieldNetwork(canvas);
    } catch {
      return;
    }
    net.current = network;
    const paint = () => network.setColors(Palette.colors.ground, Palette.colors.ink);
    paint();
    const off = Palette.bus.on("change", paint);
    return () => {
      off();
      network.dispose();
      net.current = null;
    };
  }, []);

  useEffect(() => {
    const n = net.current;
    if (!n) return;
    if (active) n.start();
    else n.stop();
    const vis = () => (document.hidden ? n.stop() : active && n.start());
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, [active]);

  return <canvas id="bg-canvas" ref={ref} className="bg" aria-hidden="true" />;
}
