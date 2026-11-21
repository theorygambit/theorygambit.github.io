import { useSyncExternalStore } from "react";
import { BackgroundCanvas } from "./ui/BackgroundCanvas";
import { ChapterScreen } from "./ui/ChapterScreen";
import { DebugOverlay } from "./ui/DebugOverlay";
import { GameScreen } from "./ui/GameScreen";
import { Home } from "./ui/Home";
import { router } from "./ui/Router";

export default function App() {
  const route = useSyncExternalStore(router.subscribe, router.getSnapshot);
  const debug = new URLSearchParams(location.search).get("debug") === "layout";
  return (
    <>
      <BackgroundCanvas active={route.name === "home"} />
      {route.name === "home" ? <Home /> : route.name === "chapter" ? <ChapterScreen key={route.id} id={route.id} /> : <GameScreen key={route.slug} slug={route.slug} />}
      {debug && <DebugOverlay />}
    </>
  );
}
