/** Draws the animated ULDs (colour slabs + neutral shell), the ground grid, and labels. */
import { boxCorners, fillFace, roundRect, strokeBox } from "./primitives.js";
import type { Project } from "./projection.js";
import type { Theme } from "../theme.js";
import { clamp, easeOut } from "../util.js";

/** One source item's colour band inside an animated ULD. */
export interface Slab {
  item: number;
  color: string;
  count: number;
  /** Slab bottom as a fraction of ULD height. */
  y0f: number;
  /** Slab top as a fraction of ULD height. */
  y1f: number;
}

/** A ULD as it animates on the deck (current + target geometry + spawn state). */
export interface AnimUld {
  cx: number;
  cz: number;
  L: number;
  W: number;
  H: number;
  tx: number;
  tz: number;
  tL: number;
  tW: number;
  tH: number;
  uld_type: string;
  fill: number;
  n_units: number;
  slabs: Slab[];
  alpha: number;
  grow: number;
  spawnAt: number;
  removing: boolean;
}

export function drawUld(ctx: CanvasRenderingContext2D, project: Project, u: AnimUld, theme: Theme): void {
  // floor shadow
  const base = boxCorners(u.cx, u.cz, u.L, u.W, 0, 0).map((p) => project(p[0], p[1], p[2]));
  fillFace(ctx, base, [0, 1, 2, 3], theme.shadow, u.alpha * 0.5);

  // colour slabs (the items inside), bottom → top
  const g = easeOut(u.grow);
  for (const s of u.slabs) {
    const y0 = s.y0f * u.H * g;
    const y1 = s.y1f * u.H * g;
    if (y1 - y0 < 0.002) continue;
    const pts = boxCorners(u.cx, u.cz, u.L * 0.92, u.W * 0.92, y0, y1).map((p) => project(p[0], p[1], p[2]));
    fillFace(ctx, pts, [4, 5, 6, 7], s.color, u.alpha * 0.16);
    strokeBox(ctx, pts, s.color, 1.3, theme.glow, u.alpha * 0.92);
  }

  // ULD shell — bright neutral contour
  const shell = boxCorners(u.cx, u.cz, u.L, u.W, 0, u.H).map((p) => project(p[0], p[1], p[2]));
  strokeBox(ctx, shell, theme.shell, 1.7, theme.glow * 0.85, u.alpha);
}

export function drawGrid(ctx: CanvasRenderingContext2D, project: Project, theme: Theme): void {
  const g = 9;
  const s = 1.4;
  ctx.lineWidth = 1;
  for (let i = -g; i <= g + 1e-6; i += s) {
    ctx.strokeStyle = Math.abs(i) < 1e-6 ? theme.gridAxis : theme.grid;
    let a = project(i, 0, -g);
    let b = project(i, 0, g);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    a = project(-g, 0, i);
    b = project(g, 0, i);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
}

export type LabelFn = (u: AnimUld) => string;

export function drawLabels(
  ctx: CanvasRenderingContext2D,
  project: Project,
  ulds: Iterable<AnimUld>,
  theme: Theme,
  label: LabelFn,
  h: number,
): void {
  ctx.font = "600 11px ui-monospace, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const u of ulds) {
    if (u.alpha < 0.3) continue;
    const p = project(u.cx, u.H + 0.001, u.cz);
    const txt = label(u);
    const y = clamp(p[1] - 12, 18, h - 8);
    const tw = ctx.measureText(txt).width;
    ctx.globalAlpha = u.alpha;
    ctx.fillStyle = theme.label.bg;
    roundRect(ctx, p[0] - tw / 2 - 7, y - 12, tw + 14, 17, 5);
    ctx.fill();
    ctx.fillStyle = theme.label.fg;
    ctx.fillText(txt, p[0], y);
    ctx.globalAlpha = 1;
  }
}
