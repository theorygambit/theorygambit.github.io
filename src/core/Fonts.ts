/** Canvas text only renders in a web font once that face is loaded, so games wait for these. */
const FACES = [
  'italic 300 24px "Cormorant Garamond"',
  '300 16px "Jost"',
  '400 16px "Jost"',
  '400 12px "JetBrains Mono"',
];

export async function loadFonts(timeoutMs = 2500): Promise<void> {
  if (!document.fonts) return;
  const all = Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => []))).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([all, timeout]);
}
