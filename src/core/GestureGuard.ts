/**
 * iPhone home screen app contract, part 3: touch.
 * No pinch zoom, no double tap zoom, no selection, no long press menu. The play
 * surface also refuses touchmove so the page can never scroll under a drag.
 */
export function installGestureGuard(): void {
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener(
    "touchmove",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (e.touches.length > 1 || target?.closest?.("[data-play]")) e.preventDefault();
    },
    { passive: false },
  );
}
