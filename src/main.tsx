import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/app.css";
import App from "./App";
import { installGestureGuard } from "./core/GestureGuard";
import { Sound } from "./core/Sound";
import { theme } from "./core/Theme";
import { installViewportSync } from "./core/Viewport";
import { registerGames } from "./games";

installViewportSync();
installGestureGuard();
theme.start();
Sound.arm();
registerGames();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
