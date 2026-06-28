/** PSV supply-vessel deck — the ULDs sit on the aft cargo deck of a hull. Default preset. */
import type { Project, Vec2, Vec3 } from "../projection.js";
import type { Theme } from "../../theme.js";
import { poly, seg } from "../primitives.js";
import type { BBox, Vehicle, VehicleDims } from "./vehicle.js";

interface ShipHull {
  X0: number; // stern (transom)
  X1: number; // bridge front / cargo edge
  X2: number; // bridge aft of bow taper
  Xbow: number; // bow point (forward)
  B: number; // outer half-width
  D: number; // hull depth
  bw: number; // bulwark height
  bh: number; // bridge height
  Bb: number; // bridge half-width
  a: number; // alpha
  any: boolean;
}

export const ship: Vehicle<ShipHull> = {
  name: "ship",

  bounds(bbox: BBox, dims: VehicleDims): ShipHull {
    const m = dims.margin ?? 0.9;
    const B = dims.beam ?? Math.max(1.6, Math.abs(bbox.minZ), Math.abs(bbox.maxZ)) + m;
    const D = dims.deckHeight ?? 1.4;
    const X0 = bbox.minX - m * 1.1;
    const X1 = bbox.maxX + m * 0.7;
    const X2 = X1 + Math.max(1.7, (X1 - X0) * 0.24);
    const Xbow = X2 + 1.5;
    return { X0, X1, X2, Xbow, B, D, bw: 0.4, bh: 1.3, Bb: B * 0.74, a: bbox.alpha, any: bbox.any };
  },

  draw(ctx: CanvasRenderingContext2D, project: Project, h: ShipHull, theme: Theme): void {
    if (h.a < 0.04 && h.any) return;
    const { X0, X1, X2, Xbow, B, D, bw, bh, Bb } = h;
    const al = h.any ? h.a : 0.5;
    const { steel, steelHi, deckFill } = theme;
    const outline: Vec2[] = [[X0, -B], [X2, -B], [Xbow, 0], [X2, B], [X0, B]];

    // deck surface + hull body
    poly(ctx, project, outline, 0, steelHi, 1.7, al * 0.9, deckFill);
    poly(ctx, project, outline, -D, steel, 1.1, al * 0.4);
    for (const p of outline) seg(ctx, project, [p[0], 0, p[1]], [p[0], -D, p[1]], steel, 1.0, al * 0.4);

    // bulwark (low wall) around the cargo deck: port, starboard, transom
    seg(ctx, project, [X0, bw, -B], [X1, bw, -B], steelHi, 1.4, al * 0.8);
    seg(ctx, project, [X0, bw, B], [X1, bw, B], steelHi, 1.4, al * 0.8);
    seg(ctx, project, [X0, bw, -B], [X0, bw, B], steelHi, 1.4, al * 0.8);
    for (const z of [-B, B]) {
      seg(ctx, project, [X0, 0, z], [X0, bw, z], steel, 1.0, al * 0.5);
      seg(ctx, project, [X1, 0, z], [X1, bw, z], steel, 1.0, al * 0.5);
    }

    // superstructure / bridge box at the forward end
    const bridge: Vec2[] = [[X1, -Bb], [X2, -Bb], [X2, Bb], [X1, Bb]];
    poly(ctx, project, bridge, 0, steel, 1.0, al * 0.5);
    poly(ctx, project, bridge, bh, steelHi, 1.5, al * 0.85);
    for (const p of bridge) seg(ctx, project, [p[0], 0, p[1]], [p[0], bh, p[1]], steelHi, 1.3, al * 0.8);
  },

  fitPoints(h: ShipHull): Vec3[] {
    const pts: Array<[number, number]> = [
      [h.X0, -h.B], [h.Xbow, 0], [h.X0, h.B], [h.X2, -h.B], [h.X2, h.B],
    ];
    const out: Vec3[] = [];
    for (const [x, z] of pts) {
      out.push([x, 0, z], [x, -h.D, z]);
    }
    return out;
  },
};
