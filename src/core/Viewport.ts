/**
 * iPhone home screen app contract, part 1: size.
 *
 * A home screen app can launch with a window shorter than the physical screen
 * (innerHeight about 797 on a 844 screen). So nothing is sized with 100vh,
 * 100dvh or inset:0. Instead the real height is measured and published as
 * --app-h, and html, body, #root and every full screen canvas use it.
 */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return !!(window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone);
}

export interface AppSize {
  w: number;
  h: number;
  fixed: boolean;
}

export function appSize(): AppSize {
  const portrait = window.matchMedia?.("(orientation: portrait)").matches ?? window.innerHeight >= window.innerWidth;
  const phone = Math.min(screen.width, screen.height) <= 600 && (window.matchMedia?.("(pointer: coarse)").matches ?? true);
  if (isStandalone() && portrait && phone) {
    return { w: window.innerWidth, h: Math.max(window.innerHeight, Math.max(screen.width, screen.height)), fixed: true };
  }
  return { w: window.innerWidth, h: window.innerHeight, fixed: false };
}

export function syncAppSize(): void {
  const { h, fixed } = appSize();
  const root = document.documentElement;
  if (fixed) root.style.setProperty("--app-h", `${h}px`);
  else root.style.removeProperty("--app-h");
}

/** iOS corrects its numbers late, so measure again shortly after launch. */
export function installViewportSync(): void {
  syncAppSize();
  window.addEventListener("resize", syncAppSize);
  window.addEventListener("orientationchange", () => setTimeout(syncAppSize, 250));
  window.visualViewport?.addEventListener("resize", syncAppSize);
  for (const ms of [120, 400, 1000, 2500]) setTimeout(syncAppSize, ms);
}

export interface Insets {
  top: number;
  bottom: number;
}

export function safeInsets(): Insets {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  probe.remove();
  return out;
}

/** Numbers instead of screenshots: everything the ?debug=layout overlay prints. */
export function layoutReport(): Record<string, string | number | boolean> {
  const vv = window.visualViewport;
  const root = document.getElementById("root");
  const rect = root?.getBoundingClientRect();
  const { h } = appSize();
  const insets = safeInsets();
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    screen: `${screen.width}x${screen.height}`,
    visualViewport: vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} @${vv.scale} off ${Math.round(vv.offsetTop)}` : "none",
    safeTop: insets.top,
    safeBottom: insets.bottom,
    appH: document.documentElement.style.getPropertyValue("--app-h") || "unset",
    rootHeight: rect ? Math.round(rect.height) : 0,
    gapUnderRoot: rect ? Math.max(0, Math.round(h - rect.bottom)) : 0,
    standalone: isStandalone(),
    dpr: window.devicePixelRatio,
  };
}
