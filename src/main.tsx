import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/app.css";
import App from "./App";
import { installGestureGuard } from "./core/GestureGuard";
import { Feedback } from "./core/Feedback";
import { theme } from "./core/Theme";
import { installViewportSync } from "./core/Viewport";
import { registerGames } from "./games";

installViewportSync();
installGestureGuard();
theme.start();
Feedback.arm();
// Every real control press gives a tap. Clicks count as a user gesture on iOS, so haptics and audio work here.
document.addEventListener("click", (e) => {
  if ((e.target as HTMLElement | null)?.closest?.("button, a[href], summary")) Feedback.tap();
});
registerGames();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
