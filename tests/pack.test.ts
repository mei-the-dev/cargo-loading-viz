import { describe, expect, it } from "vitest";
import fixtures from "./fixtures.packer.json" with { type: "json" };
import { unitize } from "../src/pack/unitize.js";
import { volCapL, ULD_CATALOG } from "../src/pack/specs.js";
import type { Item, PackedULD } from "../src/pack/types.js";

const APPROX = 1e-6;

interface Fixtures {
  inputs: Record<string, Item[]>;
  expected: Record<string, PackedULD[]>;
}
const fx = fixtures as unknown as Fixtures;

function expectUldEqual(got: PackedULD, want: PackedULD): void {
  expect(got.uld_type).toBe(want.uld_type);
  expect(got.length_m).toBeCloseTo(want.length_m, 4);
  expect(got.width_m).toBeCloseTo(want.width_m, 4);
  expect(got.height_m).toBeCloseTo(want.height_m, 4);
  expect(got.fill).toBeCloseTo(want.fill, 3);
  expect(got.n_units).toBe(want.n_units);
  expect(got.contents).toHaveLength(want.contents.length);
  got.contents.forEach((c, i) => {
    const w = want.contents[i]!;
    expect(c.item_index).toBe(w.item_index);
    expect(c.description).toBe(w.description);
    expect(c.count).toBe(w.count);
    expect(c.volume_l).toBeCloseTo(w.volume_l, 2);
    expect(c.y0).toBeCloseTo(w.y0, 4);
    expect(c.y1).toBeCloseTo(w.y1, 4);
  });
}

describe("unitize — parity with reference Python packer", () => {
  for (const name of Object.keys(fx.expected)) {
    it(`matches fixture: ${name}`, () => {
      const got = unitize(fx.inputs[name]!);
      const want = fx.expected[name]!;
      expect(got).toHaveLength(want.length);
      got.forEach((u, i) => expectUldEqual(u, want[i]!));
    });
  }
});

describe("unitize — invariants", () => {
  it("preserves total unit count", () => {
    const items: Item[] = [
      { description: "A", quantity: 3, volume_l: 100 },
      { description: "B", quantity: 5, volume_l: 40 },
    ];
    const total = unitize(items).reduce((a, u) => a + u.n_units, 0);
    expect(total).toBe(8);
  });

  it("routes container/ibc forms to their own ULD", () => {
    const ulds = unitize([{ description: "X", quantity: 2, volume_l: 900, packaging_form: "ibc" }]);
    expect(ulds).toHaveLength(2);
    expect(ulds.every((u) => u.uld_type === "IBC")).toBe(true);
  });

  it("opens a fresh ULD for oversize cargo beyond the largest catalog cap", () => {
    const largest = ULD_CATALOG[ULD_CATALOG.length - 1]!;
    const huge = volCapL(largest) + 5000;
    const ulds = unitize([{ description: "BLOCK", quantity: 1, volume_l: huge, packaging_form: "box" }]);
    expect(ulds).toHaveLength(1);
    expect(ulds[0]!.uld_type).toBe("BOX");
  });

  it("stacks slabs contiguously from the floor up", () => {
    const ulds = unitize([
      { description: "A", quantity: 1, volume_l: 800 },
      { description: "B", quantity: 1, volume_l: 400 },
    ]);
    const u = ulds[0]!;
    expect(u.contents[0]!.y0).toBeCloseTo(0, APPROX);
    for (let i = 1; i < u.contents.length; i++) {
      expect(u.contents[i]!.y0).toBeCloseTo(u.contents[i - 1]!.y1, 4);
    }
    expect(u.contents.at(-1)!.y1).toBeLessThanOrEqual(u.height_m + APPROX);
  });

  it("honours a custom catalog + eta override", () => {
    const ulds = unitize([{ description: "A", quantity: 1, volume_l: 50 }], {
      catalog: [{ name: "TINY", length_m: 1, width_m: 1, height_m: 1 }],
      eta: 1,
    });
    expect(ulds[0]!.uld_type).toBe("TINY");
  });

  it("returns nothing for no items", () => {
    expect(unitize([])).toEqual([]);
  });
});
