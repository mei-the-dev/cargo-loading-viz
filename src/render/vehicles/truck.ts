/** Flatbed trailer — the ULDs sit on a platform bed; a cab and wheels read as a truck. */
import { boxCorners, fillFace, poly, seg, strokeBox } from "../primitives.js";
import type { Project, Vec2, Vec3 } from "../projection.js";
import type { Theme } from "../../theme.js";
import type { BBox, Vehicle, VehicleDims } from "./vehicle.js";

interface TruckHull {
  X0: number; // bed rear
  X1: number; // bed front (headboard)
  Xcab: number; // cab front
  B: number; // bed half-width
  D: number; // chassis depth
  hh: number; // headboard height
  ch: number; // cab height
  Bc: number; // cab half-width
  axles: number[]; // x positions of wheel pairs
  wy0: number; // wheel bottom
  wy1: number; // wheel top
  a: number;
  any: boolean;
}

function wheel(ctx: CanvasRenderingContext2D, project: Project, x: number, z: number, h: TruckHull, theme: Theme, al: number): void {
  const c = boxCorners(x, z, 0.62, 0.34, h.wy0, h.wy1).map((p) => project(p[0], p[1], p[2]));
  fillFace(ctx, c, [1, 2, 6, 5], theme.shadow, al * 0.6);
  strokeBox(ctx, c, theme.steel, 1.1, 0, al * 0.75);
}

export const truck: Vehicle<TruckHull> = {
  name: "truck",

  bounds(bbox: BBox, dims: VehicleDims): TruckHull {
    const m = dims.margin ?? 0.8;
    const B = dims.beam ?? Math.max(1.4, Math.abs(bbox.minZ), Math.abs(bbox.maxZ)) + m;
    const D = dims.deckHeight ?? 0.55;
    const X0 = bbox.minX - m * 0.8;
    const X1 = bbox.maxX + m * 0.6;
    const Xcab = X1 + Math.max(1.6, (X1 - X0) * 0.2);
    const span = X1 - X0;
    return {
      X0, X1, Xcab, B, D,
      hh: dims.headboardHeight ?? 1.35,
      ch: dims.cabHeight ?? 1.75,
      Bc: B * 0.92,
      axles: [X0 + span * 0.16, X0 + span * 0.42, (X1 + Xcab) / 2],
      wy0: -D - 0.62,
      wy1: -D - 0.02,
      a: bbox.alpha,
      any: bbox.any,
    };
  },

  draw(ctx: CanvasRenderingContext2D, project: Project, h: TruckHull, theme: Theme): void {
    if (h.a < 0.04 && h.any) return;
    const { X0, X1, Xcab, B, D, hh, ch, Bc } = h;
    const al = h.any ? h.a : 0.5;
    const { steel, steelHi, deckFill } = theme;

    // flatbed deck surface + chassis body
    const bed: Vec2[] = [[X0, -B], [X1, -B], [X1, B], [X0, B]];
    poly(ctx, project, bed, 0, steelHi, 1.7, al * 0.9, deckFill);
    poly(ctx, project, bed, -D, steel, 1.0, al * 0.4);
    for (const p of bed) seg(ctx, project, [p[0], 0, p[1]], [p[0], -D, p[1]], steel, 1.0, al * 0.4);

    // low side rails along the bed
    seg(ctx, project, [X0, 0.18, -B], [X1, 0.18, -B], steelHi, 1.2, al * 0.7);
    seg(ctx, project, [X0, 0.18, B], [X1, 0.18, B], steelHi, 1.2, al * 0.7);

    // headboard wall at the front of the bed
    const head = boxCorners(X1 - 0.05, 0, 0.1, B * 2, 0, hh).map((p) => project(p[0], p[1], p[2]));
    fillFace(ctx, head, [4, 5, 6, 7], deckFill, al * 0.5);
    strokeBox(ctx, head, steelHi, 1.4, 0, al * 0.85);

    // cab box at the front
    const cabL = Xcab - X1;
    const cab = boxCorners(X1 + cabL / 2, 0, cabL, Bc * 2, 0, ch).map((p) => project(p[0], p[1], p[2]));
    fillFace(ctx, cab, [4, 5, 6, 7], deckFill, al * 0.45);
    strokeBox(ctx, cab, steelHi, 1.5, 0, al * 0.85);
    // windscreen rake line
    seg(ctx, project, [Xcab, ch, -Bc], [Xcab, ch * 0.55, Bc], steel, 1.0, al * 0.5);

    // wheels (two per axle)
    for (const x of h.axles) {
      wheel(ctx, project, x, -B * 0.86, h, theme, al);
      wheel(ctx, project, x, B * 0.86, h, theme, al);
    }
  },

  fitPoints(h: TruckHull): Vec3[] {
    return [
      [h.X0, 0, -h.B], [h.X0, 0, h.B], [h.X1, 0, -h.B], [h.X1, 0, h.B],
      [h.Xcab, h.ch, -h.Bc], [h.Xcab, h.ch, h.Bc],
      [h.X0, h.wy0, -h.B], [h.X0, h.wy0, h.B],
    ];
  },
};
