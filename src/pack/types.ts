/** A single source item's slab inside a ULD — one colour band in the render. */
export interface Content {
  /** Index of the source item this slab belongs to (drives palette colour). */
  item_index: number;
  description: string;
  /** How many units of this item landed in this ULD. */
  count: number;
  /** Total volume (litres) this item contributes to the load. */
  volume_l: number;
  /** Slab bottom, in metres up the ULD interior. */
  y0: number;
  /** Slab top, in metres up the ULD interior. */
  y1: number;
}

/** A packed unit-load device, render-ready. Byte-compatible with the Python output. */
export interface PackedULD {
  uld_type: string;
  length_m: number;
  width_m: number;
  height_m: number;
  /** Fill level 0..1 (used volume / capacity). */
  fill: number;
  /** Total units packed into this ULD across all items. */
  n_units: number;
  contents: Content[];
}

/** Packer input: one cargo line. `volume_l` is per single unit. */
export interface Item {
  description: string;
  quantity: number;
  /** Per-unit volume in litres. */
  volume_l: number;
  /** Optional packaging form; certain forms become their own ULD. */
  packaging_form?: string;
}

/** A ULD catalog entry — an empty container the packer can open. */
export interface UldSpec {
  name: string;
  length_m: number;
  width_m: number;
  height_m: number;
}

/** Overrides for {@link unitize}. Defaults reproduce the reference Python behaviour. */
export interface UnitizeOptions {
  /** Usable-volume efficiency (void space / irregular cargo). Default 0.7. */
  eta?: number;
  /** ULD catalog, ordered small → large by volume. */
  catalog?: readonly UldSpec[];
  /** Forms that are reliably their own ULD (e.g. container, ibc). */
  selfUldForms?: Iterable<string>;
  /** Footprint dimensions [L, W, H] for self-unitizing forms. */
  selfDims?: Record<string, readonly [number, number, number]>;
}
