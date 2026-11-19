/** Whole numbers where possible, at most two decimals otherwise. */
export const fmt = (v: number): string => String(Math.round(v * 100) / 100);
