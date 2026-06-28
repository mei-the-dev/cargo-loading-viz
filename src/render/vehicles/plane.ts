/** Freighter main deck — ULDs on a flat cargo floor under a curved fuselage tube (747F read). */
import { poly } from "../primitives.js";
import type { Project, Vec2, Vec3 } from "../projection.js";
import type { Theme } from "../../theme.js";
import type { BBox, Vehicle, VehicleDims } from "./vehicle.js";

interface PlaneHull {
  X0: number; // cargo floor rear
  X1: number; // cargo floor front
  Xtail: number; // fuselage tail
  Xnose: number; // fuselage nose
  B: number; // half-width
  topH: number; // crown above floor
  bellyH: number; // belly below floor
  cY: number; // vertical centre of the tube
  Ry: number; // vertical radius
  a: number;
  any: boolean;
}

const RIBS = 11;
const SEG = 28;
/** Longeron angles: right side, crown, left side, belly. */
const LONGERONS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

/** Radius scale along the body: full over the cargo bay, tapering to nose and tail. */
function radius(x: number, h: PlaneHull): number {
  if (x >= h.X0 && x <= h.X1) return 1;
  if (x > h.X1) {
    const t = (x - h.X1) / (h.Xnose - h.X1);
    return 1 - (1 - 0.12) * (t * t);
  }
  const t = (h.X0 - x) / (h.X0 - h.Xtail);
  return 1 - (1 - 0.2) * (t * t * (3 - 2 * t));
}

/** A point on the fuselage cross-section at station `x`, angle `a`. */
function shell(x: number, a: number, h: PlaneHull): Vec3 {
  const r = radius(x, h);
  return [x, h.cY + h.Ry * r * Math.sin(a), h.B * r * Math.cos(a)];
}

export const plane: Vehicle<PlaneHull> = {
  name: "plane",

  bounds(bbox: BBox, dims: VehicleDims): PlaneHull {
    const m = dims.margin ?? 0.9;
    const B = dims.beam ?? Math.max(1.7, Math.abs(bbox.minZ), Math.abs(bbox.maxZ)) + m;
    const X0 = bbox.minX - m;
    const X1 = bbox.maxX + m;
    const span = X1 - X0;
    const topH = dims.fuselageHeight ?? B * 0.98;
    const bellyH = dims.bellyHeight ?? B * 0.4;
    return {
      X0, X1,
      Xtail: X0 - Math.max(2.0, span * 0.5),
      Xnose: X1 + Math.max(2.6, span * 0.6),
      B, topH, bellyH,
      cY: (topH - bellyH) / 2,
      Ry: (topH + bellyH) / 2,
      a: bbox.alpha,
      any: bbox.any,
    };
  },

  draw(ctx: CanvasRenderingContext2D, project: Project, h: PlaneHull, theme: Theme): void {
    if (h.a < 0.04 && h.any) return;
    const al = h.any ? h.a : 0.5;
    const { steel, steelHi, deckFill } = theme;

    // cargo floor (main deck) the ULDs rest on
    const floor: Vec2[] = [[h.X0, -h.B * 0.96], [h.X1, -h.B * 0.96], [h.X1, h.B * 0.96], [h.X0, h.B * 0.96]];
    poly(ctx, project, floor, 0, steelHi, 1.6, al * 0.9, deckFill);

    // fuselage ribs (cross-sections)
    for (let i = 0; i < RIBS; i++) {
      const x = h.Xtail + ((h.Xnose - h.Xtail) * i) / (RIBS - 1);
      const inBay = x >= h.X0 - 0.01 && x <= h.X1 + 0.01;
      ctx.globalAlpha = al * (inBay ? 0.5 : 0.32);
      ctx.strokeStyle = inBay ? steelHi : steel;
      ctx.lineWidth = inBay ? 1.3 : 1.0;
      ctx.beginPath();
      for (let s = 0; s <= SEG; s++) {
        const p = shell(x, (Math.PI * 2 * s) / SEG, h);
        const q = project(p[0], p[1], p[2]);
        s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // longitudinal stringers (crown, sides, belly) nose → tail
    for (const ang of LONGERONS) {
      ctx.globalAlpha = al * (ang === Math.PI / 2 ? 0.7 : 0.4);
      ctx.strokeStyle = ang === Math.PI / 2 ? steelHi : steel;
      ctx.lineWidth = ang === Math.PI / 2 ? 1.4 : 1.0;
      ctx.beginPath();
      for (let i = 0; i <= RIBS * 2; i++) {
        const x = h.Xtail + ((h.Xnose - h.Xtail) * i) / (RIBS * 2);
        const p = shell(x, ang, h);
        const q = project(p[0], p[1], p[2]);
        i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  fitPoints(h: PlaneHull): Vec3[] {
    const xm = (h.X0 + h.X1) / 2;
    return [
      [xm, h.cY + h.Ry, 0], [xm, h.cY - h.Ry, 0],
      [xm, h.cY, -h.B], [xm, h.cY, h.B],
      [h.Xnose, h.cY, 0], [h.Xtail, h.cY, 0],
      [h.X0, 0, -h.B], [h.X1, 0, h.B],
    ];
  },
};
