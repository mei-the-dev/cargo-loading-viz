/** The vehicle abstraction: a hull the ULDs sit in/on. Presets implement this. */
import type { Project, Vec3 } from "../projection.js";
import type { Theme } from "../../theme.js";

/** Footprint of the visible ULDs on the deck, plus fade state. */
export interface BBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Max alpha across contributing ULDs (0 when none). */
  alpha: number;
  /** Whether any ULD is currently visible. */
  any: boolean;
}

/** Public dimension overrides. Presets read the keys they care about. */
export interface VehicleDims {
  /** Padding between the cargo footprint and the hull edge. */
  margin?: number;
  /** Outer half-width (beam) of the hull. */
  beam?: number;
  /** Hull depth below the deck surface. */
  deckHeight?: number;
  /** Preset-specific extras (cabHeight, fuselageHeight, bowLength…). */
  [key: string]: number | undefined;
}

/**
 * A drawable cargo vehicle. `bounds` derives hull geometry from the cargo footprint;
 * `draw` paints it; `fitPoints` returns world-space extent points so the camera autofit
 * frames the whole vehicle.
 */
export interface Vehicle<H = unknown> {
  readonly name: string;
  bounds(bbox: BBox, dims: VehicleDims): H;
  draw(ctx: CanvasRenderingContext2D, project: Project, hull: H, theme: Theme): void;
  fitPoints(hull: H): Vec3[];
}
