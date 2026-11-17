import { useEffect, useState } from "react";
import { layoutReport } from "../core/Viewport";

/** ?debug=layout prints the numbers behind every layout problem, so nobody has to send screenshots. */
export function DebugOverlay() {
  const [text, setText] = useState("");
  useEffect(() => {
    const tick = () => setText(Object.entries(layoutReport()).map(([k, v]) => `${k.padEnd(15)} ${v}`).join("\n"));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);
  return <pre className="debug" id="debug-layout">{text}</pre>;
}
