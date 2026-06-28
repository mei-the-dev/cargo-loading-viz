/**
 * Unitization: pack items into ULDs (the offshore packing layer).
 *
 * A ULD is a *tall box* with a VOLUME capacity (footprint × internal-height × eta);
 * items **stack** inside (volume is the binding capacity, not single-layer footprint),
 * and packing is **best-fit-decreasing by volume** — a new ULD opens at the smallest
 * catalog type that fits. Container/IBC-like items are their own ULD.
 *
 * Output is render-ready: each load lists contents grouped by source item, with a
 * vertical slab [y0, y1] per item proportional to its volume share of the load.
 *
 * Port of `cargo_llm/pack/unitize.py`, behaviour-preserving.
 */
import type { Content, Item, PackedULD, UldSpec, UnitizeOptions } from "./types.js";
import { ETA, SELF_DIMS, SELF_ULD_FORMS, ULD_CATALOG, volCapL } from "./specs.js";

const round = (x: number, n: number): number => {
  const f = 10 ** n;
  return Math.round(x * f) / f;
};

interface Unit {
  index: number;
  description: string;
  volume_l: number;
  form: string;
}

class UldLoad {
  used_l = 0;
  private readonly contents = new Map<number, Content & { _vol: number }>();

  constructor(
    readonly uld_type: string,
    readonly length_m: number,
    readonly width_m: number,
    readonly height_m: number,
    readonly vol_cap_l: number,
  ) {}

  get remaining_l(): number {
    return this.vol_cap_l - this.used_l;
  }

  add(itemIndex: number, description: string, volumeL: number): void {
    let c = this.contents.get(itemIndex);
    if (!c) {
      c = { item_index: itemIndex, description, count: 0, volume_l: 0, y0: 0, y1: 0, _vol: 0 };
      this.contents.set(itemIndex, c);
    }
    c.count += 1;
    c._vol += volumeL;
    this.used_l += volumeL;
  }

  /** Finalize: vertical slabs per item (stacked by volume), render-ready ULD. */
  layout(): PackedULD {
    const ordered = [...this.contents.values()].sort((a, b) => b._vol - a._vol);
    const fill = this.vol_cap_l ? Math.min(1, this.used_l / this.vol_cap_l) : 0;
    let y = 0;
    const contents: Content[] = ordered.map((c) => {
      const frac = this.used_l ? c._vol / this.used_l : 0;
      const h = frac * fill * this.height_m;
      const slab: Content = {
        item_index: c.item_index,
        description: c.description,
        count: c.count,
        volume_l: round(c._vol, 2),
        y0: round(y, 4),
        y1: round(y + h, 4),
      };
      y += h;
      return slab;
    });
    return {
      uld_type: this.uld_type,
      length_m: this.length_m,
      width_m: this.width_m,
      height_m: this.height_m,
      fill: round(fill, 3),
      n_units: ordered.reduce((a, c) => a + c.count, 0),
      contents,
    };
  }
}

function selfLoad(
  unit: Unit,
  selfDims: Record<string, readonly [number, number, number]>,
  largest: UldSpec,
): UldLoad {
  const dims = selfDims[unit.form] ?? [largest.length_m, largest.width_m, largest.height_m];
  const [L, W, H] = dims;
  const load = new UldLoad(unit.form.toUpperCase(), L, W, H, L * W * H * 1000);
  load.add(unit.index, unit.description, Math.min(unit.volume_l, load.vol_cap_l));
  return load;
}

/**
 * Pack items (expanded by quantity) into ULDs; return render-ready loads.
 *
 * Loads come out in the order: self-unitized / oversize items first (in input order),
 * then loose-cargo baskets in the order they were opened.
 */
export function unitize(items: readonly Item[], opts: UnitizeOptions = {}): PackedULD[] {
  const eta = opts.eta ?? ETA;
  const catalog = opts.catalog ?? ULD_CATALOG;
  const selfForms =
    opts.selfUldForms instanceof Set
      ? (opts.selfUldForms as ReadonlySet<string>)
      : opts.selfUldForms
        ? new Set(opts.selfUldForms)
        : SELF_ULD_FORMS;
  const selfDims = opts.selfDims ?? SELF_DIMS;
  const largest = catalog[catalog.length - 1];
  if (!largest) throw new Error("unitize: catalog must not be empty");
  const largestCap = volCapL(largest, eta);

  // expand to units
  const units: Unit[] = [];
  items.forEach((it, index) => {
    const n = Math.max(1, Math.round(it.quantity));
    const volume_l = Math.max(0.001, it.volume_l);
    const form = it.packaging_form ?? "other";
    for (let k = 0; k < n; k++) units.push({ index, description: it.description, volume_l, form });
  });

  const loads: UldLoad[] = [];
  const loose: Unit[] = [];
  for (const u of units) {
    if (selfForms.has(u.form) || u.volume_l > largestCap) loads.push(selfLoad(u, selfDims, largest));
    else loose.push(u);
  }

  // best-fit-decreasing by volume
  loose.sort((a, b) => b.volume_l - a.volume_l);
  const open: UldLoad[] = [];
  for (const u of loose) {
    let best: UldLoad | null = null;
    for (const ld of open) {
      if (ld.remaining_l >= u.volume_l && (best === null || ld.remaining_l < best.remaining_l)) best = ld;
    }
    if (best === null) {
      const spec = catalog.find((s) => volCapL(s, eta) >= u.volume_l) ?? largest;
      best = new UldLoad(spec.name, spec.length_m, spec.width_m, spec.height_m, volCapL(spec, eta));
      open.push(best);
    }
    best.add(u.index, u.description, u.volume_l);
  }
  loads.push(...open);

  return loads.map((ld) => ld.layout());
}
