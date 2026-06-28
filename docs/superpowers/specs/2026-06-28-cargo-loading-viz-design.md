# cargo-loading-viz — Design Spec

**Date:** 2026-06-28
**Status:** Approved (brainstorming) → pending implementation plan
**Repo:** new, standalone — `/Users/mei/dev/cargo-loading-viz`
**License:** MIT
**Package name:** `cargo-loading-viz`

## 1. Purpose

A small, dependency-free TypeScript library that renders an animated 3D cargo-loading
scene: items packed into ULDs (unit load devices), drawn as colour-coded volume slabs
inside ULD shells, sitting in/on a chosen **vehicle** — truck, ship, or plane.

It is extracted and generalized from the `cargo-llm` web app's `Viz3D` Canvas-2D
renderer (`src/cargo_llm/webapp/static/viz3d.js`) and the Python `unitize()` packer
(`src/cargo_llm/pack/unitize.py`), made reusable and published to npm + GitHub.

Scope is **render + pack + animation export**. It does NOT include dimension
prediction (the LLM layer) or any backend coupling. Consumers bring item volumes (or
already-packed ULDs) and get a polished visual.

## 2. Goals / Non-Goals

**Goals**
- Framework-agnostic core usable via `import` or `<script>`; thin React wrapper.
- Three first-class vehicle presets (truck, ship, plane) plus a custom-vehicle hook.
- Customizable: vehicle preset + dimensions, theme/palette, camera + motion, labels + legend.
- Animation export to WebM (zero extra deps, browser `MediaRecorder`).
- Optional JS port of the BFD-by-volume packer so consumers can go from items → ULDs.
- Byte-compatible ULD data contract with the existing Python `unitize()` output, so
  `cargo-llm`'s `/api/deck` endpoint keeps working unchanged.
- Zero runtime dependencies. React is a peer dep on the `/react` subpath only.

**Non-Goals**
- No dimension/form prediction, no model inference, no network/data-loading helpers.
- No physics or true collision packing — the packer is the existing volume-share heuristic.
- No WebGL/Three.js — stays Canvas 2D for portability and zero deps.
- No GIF/MP4 export in v1 (WebM only).

## 3. Package shape

Single package, multiple entry points via the `exports` map:

| Entry | Import | Contents |
|-------|--------|----------|
| core | `cargo-loading-viz` | `CargoViz`, `unitize`, presets, themes, all types |
| react | `cargo-loading-viz/react` | `<CargoViz/>` component (React peer dep) |

Build: **tsup** → ESM + UMD + `.d.ts`. `sideEffects: false`. React excluded from the
core bundle and marked external in the react bundle.

## 4. Source layout

```
src/
├── pack/
│   ├── specs.ts        ULD catalog + self-unitize dims + ETA constant (overridable)
│   ├── unitize.ts      port of unitize.py — best-fit-decreasing by volume
│   └── types.ts        Item, PackedULD, Content, UldSpec
├── render/
│   ├── CargoViz.ts     class: mount/update/dispose, RAF loop, camera state, autofit
│   ├── projection.ts   rotate / project / computeFit (pure math, unit-tested)
│   ├── primitives.ts   strokeBox / poly / seg / boxCorners / roundRect
│   ├── uld.ts          draw slabs + shell + per-ULD labels + ground grid
│   └── vehicles/
│       ├── vehicle.ts  Vehicle interface + VehicleDims
│       ├── ship.ts     PSV supply-vessel deck (port of current drawShip) — default
│       ├── truck.ts    flatbed trailer: bed + headboard + wheels
│       └── plane.ts    freighter main deck with curved fuselage arc overhead
├── theme.ts            Theme type + light/dark defaults
├── camera.ts           CameraOptions + interaction binding (drag/wheel/dblclick)
├── legend.ts           optional legend/caption DOM helpers (opt-in)
├── export.ts           recordWebM(canvas, opts) via MediaRecorder
├── index.ts            public core API barrel
└── react/
    └── CargoViz.tsx     React wrapper around the core class
```

Every file stays focused (<200 lines target, 800 hard max). The current monolithic
338-line `viz3d.js` is split along the boundaries above.

## 5. Data contract (stable)

Matches the Python `unitize()` output exactly so the contract is shared:

```ts
interface Content {
  item_index: number;   // which source item this slab belongs to (→ palette colour)
  description: string;
  count: number;
  volume_l: number;
  y0: number;           // slab bottom, in metres up the ULD
  y1: number;           // slab top
}

interface PackedULD {
  uld_type: string;     // e.g. "CESTA", "CONTAINER_DRY"
  length_m: number;
  width_m: number;
  height_m: number;
  fill: number;         // 0..1 used/cap
  n_units: number;
  contents: Content[];
}

interface Item {        // packer input
  description: string;
  quantity: number;
  volume_l: number;     // per-unit volume
  packaging_form?: string;  // optional; drives self-unitization (container/ibc/…)
}
```

`viz.update(ulds: PackedULD[], items?: { description: string }[])` — `items` only feeds
the legend (palette index → description). `unitize(items, opts?)` produces `PackedULD[]`.

## 6. The Vehicle abstraction (core new design)

```ts
interface VehicleHull { /* preset-specific computed geometry */ }

interface VehicleDims {
  margin?: number;       // padding around the ULD footprint
  beam?: number;         // half-width override (ship/plane) / bed width (truck)
  deckHeight?: number;   // hull depth below deck
  // preset-specific extras (bowLength, fuselageRadius, cabHeight…) are optional
}

interface Vehicle {
  /** Compute hull geometry from the bounding box of the packed ULDs. */
  bounds(uldBBox: BBox, dims: VehicleDims): VehicleHull;
  /** Draw the hull. `project` maps world (x,y,z) → screen; `alpha` fades it in. */
  draw(ctx: CanvasRenderingContext2D, hull: VehicleHull, project: Project, theme: Theme, alpha: number): void;
  /** Hull extent points fed into the camera autofit so the whole vehicle frames. */
  fitPoints(hull: VehicleHull): Vec3[];
}
```

- The current `shipBounds()` + `drawShip()` + the ship-extent block inside `computeFit()`
  map directly onto `bounds` / `draw` / `fitPoints` for `ship.ts`.
- `truck.ts`: rectangular flatbed deck, raised headboard at the front, two axle/wheel
  groups beneath the bed. Reads as a trailer.
- `plane.ts`: flat cargo floor with a curved fuselage arc drawn overhead (semicircle of
  the beam radius) and nose/tail taper — a freighter main deck (747F read).
- Presets resolve by string: `vehicle: 'truck' | 'ship' | 'plane'`, or pass a custom
  object implementing `Vehicle`.

## 7. Public API

```ts
import { CargoViz, unitize } from 'cargo-loading-viz'

const viz = new CargoViz(canvas, {
  vehicle: 'ship',
  vehicleDims: { beam: 4, deckHeight: 1.4 },
  theme: 'dark',                      // 'light' | 'dark' | Theme
  camera: {
    yaw: 0.6, pitch: -0.5, zoom: 1,
    autorotate: true, speed: 0.0028,
    zoomMin: 0.35, zoomMax: 3,
    interactive: true,                // drag/wheel/dblclick
  },
  labels: true,
  legend: true,                       // requires a legend container, else no-op
  label: (u) => `${u.uld_type} · ${u.n_units}u · ${Math.round(u.fill*100)}%`,
})

const ulds = unitize(items)
viz.update(ulds, items)

// imperative controls
viz.setVehicle('plane')
viz.setTheme('light')
viz.resetCamera()

// animation export
const blob = await viz.recordWebM({ durationMs: 6000, fps: 60, mimeType?: string })

viz.dispose()                         // cancels RAF, removes listeners
```

React:

```tsx
import { CargoViz } from 'cargo-loading-viz/react'

<CargoViz
  ulds={ulds} items={items}
  vehicle="plane" theme="dark"
  camera={{ autorotate: true }}
  onReady={(viz) => { /* imperative handle */ }}
/>
```

The component owns a `<canvas>` ref, instantiates the core class in an effect, calls
`update` on prop changes, and `dispose` on unmount. No re-instantiation on prop change.

## 8. Theme

```ts
interface Theme {
  palette: string[];     // per-item slab colours (cycled by item_index)
  shell: string;         // neutral ULD contour
  grid: string; gridAxis: string;
  background: string;    // canvas clear / page hint
  steel: string; steelHi: string;   // vehicle hull strokes
  glow: number;          // shadowBlur amount
  label: { bg: string; fg: string };
}
```

Ship the current dark palette as `dark` and a tuned `light` variant. A partial theme
object is merged over the chosen base.

## 9. Animation export

`recordWebM(canvas, opts)` uses `canvas.captureStream(fps)` + `MediaRecorder`, collects
chunks, resolves a `Blob` after `durationMs`. Picks the first supported `video/webm`
codec (`vp9` → `vp8`). Throws a clear error if `MediaRecorder` is unavailable
(non-browser / unsupported). No extra dependency.

## 10. Packer port

Direct port of `unitize.py`, behaviour-preserving:
- `ETA = 0.7`, `SELF_ULD_FORMS = {container, ibc}`, the `ULD_CATALOG` (5 specs ordered
  small→large), and `_SELF_DIMS` become exported, overridable constants in `specs.ts`.
- `unitize(items, opts?)`: expand by quantity → split self-ULD/oversize vs loose →
  best-fit-decreasing by volume → `layout()` produces slabs with `y0/y1` proportional to
  each item's volume share of the load, scaled by the load fill level.
- `opts` allows overriding catalog, eta, and self-dims; defaults reproduce Python output.
- Cross-checked in tests against fixtures generated from the Python implementation.

## 11. Testing

Per web testing rules (visual regression carries the signal for visual code):

1. **Unit (Vitest):**
   - Packer: BFD selection, self-ULD routing, oversize handling, fill clamp, slab
     `y0/y1` stacking, `n_units` totals — asserted against Python-generated fixtures.
   - Projection math: `rotate`, `project`, `computeFit` framing for known inputs.
2. **Visual regression (Playwright):** demo at 320 / 768 / 1024 / 1440, light + dark,
   each vehicle preset, empty + loaded states. Deterministic: autorotate off + fixed
   camera + seeded data + paused RAF (single rendered frame) for stable screenshots.
3. **Smoke:** `new CargoViz` mounts, `update` runs a frame, `dispose` cleans up listeners
   (jsdom + stubbed canvas where needed).

Coverage target 80% on pure logic (packer, projection, theme merge, export guard).
Canvas drawing is covered by visual regression rather than markup assertions.

## 12. Demo (GitHub Pages)

Vite app under `demo/`:
- Vehicle switcher (truck / ship / plane).
- Live controls: theme toggle, autorotate, labels/legend, sample-cargo presets, an
  editable item list that runs through `unitize`.
- "Record WebM" button using `recordWebM`, offering the blob as a download.
- Deployed to GitHub Pages via Actions on push to `main`.

## 13. Repo, CI, publish

- Fresh `git init`, MIT `LICENSE`, `.gitignore`, `README.md` with an embedded recorded
  clip and copy-paste examples for core + React.
- `package.json`: `exports` map (core + `/react`), `types`, `files`, `sideEffects:false`,
  React as optional peer dep.
- **GitHub Actions:**
  - CI: install, typecheck, unit tests, build, Playwright visual tests.
  - Pages: build demo → deploy on `main`.
  - Publish: on `v*` tag → `npm publish --access public` (provenance enabled).

## 14. Build order (phases)

1. Scaffold (tsup, tsconfig, vitest, package.json, license, gitignore) + types + port packer (+ unit tests).
2. Port renderer core (projection, primitives, uld, CargoViz) with the **ship** preset → visual parity with today.
3. Add **truck** + **plane** vehicles behind the `Vehicle` interface.
4. Wire customization: vehicle dims, theme (light/dark), camera/motion, labels/legend + custom formatter.
5. WebM export.
6. React wrapper.
7. Demo app + Playwright visual regression.
8. README + CI + Pages + npm publish.

## 15. Risks / open questions

- **Truck/plane visual quality:** the ship took iteration to read well; truck and plane
  need the same care. Mitigated by visual-regression snapshots and demo review.
- **WebM browser support:** Safari's `MediaRecorder` WebM support is partial; documented
  as a known limitation, with a clear runtime error. GIF/MP4 deferred.
- **Packer parity:** floating-point ordering differences vs Python; tests assert with a
  tolerance and fixed input ordering.
- **`cargo-llm` adoption:** swapping the app's inlined `viz3d.js` for the published
  package is a follow-up, out of scope for this spec (contract is kept compatible to make
  it a drop-in later).
```
