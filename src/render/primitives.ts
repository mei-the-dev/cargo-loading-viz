/** Low-level Canvas-2D drawing helpers shared by the ULD renderer and vehicles. */
import type { Project, Vec2, Vec3 } from "./projection.js";

/** The 12 edges of a box, indexing the 8 corners produced by {@link boxCorners}. */
export const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** 8 world-space corners of an axis-aligned box on the deck, bottom face first. */
export function boxCorners(
  cx: number,
  cz: number,
  L: number,
  W: number,
  y0: number,
  y1: number,
): Vec3[] {
  const x0 = cx - L / 2;
  const x1 = cx + L / 2;
  const z0 = cz - W / 2;
  const z1 = cz + W / 2;
  return [
    [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
    [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  ];
}

/** Stroke the wireframe of a projected box (8 screen points) with optional glow. */
export function strokeBox(
  ctx: CanvasRenderingContext2D,
  pts: Vec3[],
  color: string,
  width: number,
  glow: number,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  for (const [a, c] of EDGES) {
    ctx.beginPath();
    ctx.moveTo(pts[a]![0], pts[a]![1]);
    ctx.lineTo(pts[c]![0], pts[c]![1]);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** Fill one face of a projected box, given the 4 corner indices. */
export function fillFace(
  ctx: CanvasRenderingContext2D,
  pts: Vec3[],
  face: readonly [number, number, number, number],
  color: string,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  face.forEach((i, k) => (k ? ctx.lineTo(pts[i]![0], pts[i]![1]) : ctx.moveTo(pts[i]![0], pts[i]![1])));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Draw a closed polygon at constant deck height `y`, with optional fill. */
export function poly(
  ctx: CanvasRenderingContext2D,
  project: Project,
  pts: ReadonlyArray<Vec2>,
  y: number,
  color: string,
  lw: number,
  alpha: number,
  fill?: string,
): void {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = project(p[0], y, p[1]);
    i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
  });
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Draw a single world-space line segment. */
export function seg(
  ctx: CanvasRenderingContext2D,
  project: Project,
  a: Vec3,
  b: Vec3,
  color: string,
  lw: number,
  alpha: number,
): void {
  const p = project(a[0], a[1], a[2]);
  const q = project(b[0], b[1], b[2]);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(q[0], q[1]);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Trace a rounded rectangle path (label chips). Caller fills/strokes. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
