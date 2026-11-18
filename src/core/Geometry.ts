export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inside = (b: Box, x: number, y: number): boolean => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
