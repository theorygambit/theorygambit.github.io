import { useLayoutEffect, type RefObject } from "react";
import { router } from "./Router";

/** Keeps a scrolling screen's position, so Back returns to exactly where you were. */
export function useScrollMemory(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const path = location.pathname;
    el.scrollTop = router.recall(path);
    return () => router.remember(path, el.scrollTop);
  }, [ref]);
}
