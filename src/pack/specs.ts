import type { UldSpec } from "./types.js";

/** Usable-volume efficiency (void space / irregular cargo / external→internal). */
export const ETA = 0.7;

/**
 * Forms that are reliably their OWN ULD. Kept deliberately narrow: predicted form is
 * noisy (a cement bag → "pallet"), and self-unitizing on a wrong form explodes into one
 * ULD per unit. "pallet"/"skid" self-unitize only when their volume exceeds a basket.
 */
export const SELF_ULD_FORMS: ReadonlySet<string> = new Set(["container", "ibc"]);

/** Loose-cargo basket/container catalog, ordered small → large by volume cap. */
export const ULD_CATALOG: readonly UldSpec[] = [
  { name: "CESTA", length_m: 3.05, width_m: 1.22, height_m: 1.4 },
  { name: "MLTU_BOX", length_m: 2.0, width_m: 2.0, height_m: 1.5 },
  { name: "OCTO", length_m: 2.44, width_m: 2.44, height_m: 1.8 },
  { name: "CONTAINER_SMALL", length_m: 2.99, width_m: 2.44, height_m: 1.9 },
  { name: "CONTAINER_DRY", length_m: 6.06, width_m: 2.44, height_m: 2.39 },
];

/** Footprint a self-unitizing form occupies as its own ULD: [L, W, H] metres. */
export const SELF_DIMS: Record<string, readonly [number, number, number]> = {
  container: [6.06, 2.44, 2.39],
  pallet: [1.2, 1.0, 1.5],
  ibc: [1.2, 1.0, 1.2],
  skid: [3.0, 2.0, 1.5],
  cacamba: [3.0, 1.5, 1.2],
};

/** Effective volume capacity (litres) of a catalog ULD at efficiency `eta`. */
export const volCapL = (s: UldSpec, eta: number = ETA): number =>
  s.length_m * s.width_m * s.height_m * 1000 * eta;
