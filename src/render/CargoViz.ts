/** The renderer: mounts on a canvas, animates packed ULDs in a chosen vehicle. */
import type { PackedULD } from "../pack/types.js";
import { type CameraOptions, type CameraState, resolveCamera } from "../camera.js";
import { type RecordOptions, recordWebM } from "../export.js";
import { type Theme, type ThemeInput, resolveTheme } from "../theme.js";
import { clamp, easeOut, lerp } from "../util.js";
import { boxCorners } from "./primitives.js";
import { type CameraAngles, type FitState, depth, makeProject, projectRaw } from "./projection.js";
import { type AnimUld, type LabelFn, drawGrid, drawLabels, drawUld } from "./uld.js";
import { type BBox, type Vehicle, type VehicleDims, type VehicleName, resolveVehicle } from "./vehicles/index.js";

/** Item shape used only for the legend (palette index → description). */
export interface LegendItem {
  description: string;
}

export interface CargoVizOptions {
  vehicle?: VehicleName | Vehicle;
  vehicleDims?: VehicleDims;
  theme?: ThemeInput;
  camera?: CameraOptions;
  /** Draw per-ULD labels. Default true. */
  labels?: boolean;
  /** Render legend chips into `legendEl`. Default false (no-op without a container). */
  legend?: boolean;
  legendEl?: HTMLElement | null;
  captionEl?: HTMLElement | null;
  /** Custom per-ULD label text. */
  label?: LabelFn;
  /** Start the animation loop immediately. Default true. */
  autoStart?: boolean;
}

const DEFAULT_LABEL: LabelFn = (u) => `${u.uld_type} · ${u.n_units}u · ${Math.round((u.fill || 0) * 100)}%`;
const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const now = (): number => (typeof performance !== "undefined" ? performance.now() : 0);

export class CargoViz {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;

  private ulds = new Map<string, AnimUld>();
  private legendItems: LegendItem[] = [];

  private cam: CameraState;
  private readonly camInit: Pick<CameraState, "yaw" | "pitch" | "zoom">;
  private readonly autoConfig: boolean;
  private fit: FitState = { s: 0, cx: 0, cy: 0 };

  private theme: Theme;
  private vehicle: Vehicle;
  private dims: VehicleDims;
  private labelFn: LabelFn;
  private readonly opts: Required<Pick<CargoVizOptions, "labels" | "legend">> &
    Pick<CargoVizOptions, "legendEl" | "captionEl">;

  private raf: number | null = null;
  private prevT = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private resumeT: ReturnType<typeof setTimeout> | null = null;
  private readonly cleanup: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, options: CargoVizOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CargoViz: could not get a 2D canvas context");
    this.ctx = ctx;
    this.dpr = Math.min(typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1, 2);

    this.cam = resolveCamera(options.camera);
    this.camInit = { yaw: this.cam.yaw, pitch: this.cam.pitch, zoom: this.cam.zoom };
    this.autoConfig = this.cam.autorotate;
    this.theme = resolveTheme(options.theme);
    this.vehicle = resolveVehicle(options.vehicle);
    this.dims = options.vehicleDims ?? {};
    this.labelFn = options.label ?? DEFAULT_LABEL;
    this.opts = {
      labels: options.labels ?? true,
      legend: options.legend ?? false,
      legendEl: options.legendEl,
      captionEl: options.captionEl,
    };

    if (this.cam.interactive) this.bind();
    if (options.autoStart !== false) this.start();
  }

  // ---- public API ----

  update(ulds: PackedULD[], items: LegendItem[] = []): void {
    this.legendItems = items;
    const tgt = this.targets(ulds);
    const t = now();
    tgt.forEach((g, key) => {
      const u = this.ulds.get(key);
      if (u) {
        Object.assign(u, {
          tx: g.cx, tz: g.cz, tL: g.L, tW: g.W, tH: g.H,
          uld_type: g.uld_type, fill: g.fill, n_units: g.n_units, slabs: g.slabs, removing: false,
        });
      } else {
        this.ulds.set(key, {
          cx: g.cx, cz: g.cz, L: g.L, W: g.W * 0.001, H: g.H,
          tx: g.cx, tz: g.cz, tL: g.L, tW: g.W, tH: g.H,
          uld_type: g.uld_type, fill: g.fill, n_units: g.n_units, slabs: g.slabs,
          alpha: 0, grow: 0, spawnAt: t + (parseInt(key.slice(1), 10) || 0) * 60, removing: false,
        });
      }
    });
    this.ulds.forEach((u, key) => {
      if (!tgt.has(key)) u.removing = true;
    });
    this.renderLegend();
    this.renderCaption(ulds);
  }

  setVehicle(v: VehicleName | Vehicle): void {
    this.vehicle = resolveVehicle(v);
  }
  setVehicleDims(dims: VehicleDims): void {
    this.dims = dims;
  }
  setTheme(t: ThemeInput): void {
    this.theme = resolveTheme(t);
    this.renderLegend();
  }
  setLabel(fn: LabelFn): void {
    this.labelFn = fn;
  }
  setLabelsVisible(v: boolean): void {
    this.opts.labels = v;
  }
  setAutorotate(v: boolean): void {
    this.cam.autorotate = v;
  }
  resetCamera(): void {
    this.cam.yaw = this.camInit.yaw;
    this.cam.pitch = this.camInit.pitch;
    this.cam.zoom = this.camInit.zoom;
    this.cam.autorotate = this.autoConfig;
  }

  recordWebM(opts?: RecordOptions): Promise<Blob> {
    return recordWebM(this.canvas, opts);
  }

  start(): void {
    if (this.raf !== null) return;
    this.prevT = now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  stop(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
  dispose(): void {
    this.stop();
    if (this.resumeT) clearTimeout(this.resumeT);
    for (const off of this.cleanup) off();
    this.cleanup.length = 0;
    this.ulds.clear();
  }

  // ---- layout ----

  private color(i: number): string {
    return this.theme.palette[i % this.theme.palette.length]!;
  }

  private targets(list: PackedULD[]): Map<string, Omit<AnimUld, "tx" | "tz" | "tL" | "tW" | "tH" | "alpha" | "grow" | "spawnAt" | "removing">> {
    const out = new Map<string, ReturnType<CargoViz["targetEntry"]>>();
    if (!list.length) return out;
    const maxDim = Math.max(1.2, ...list.flatMap((u) => [u.length_m, u.width_m, u.height_m]));
    const scale = 3.0 / maxDim;
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const cell = Math.max(...list.map((u) => Math.max(u.length_m, u.width_m))) * scale * 1.55;
    const rows = Math.ceil(list.length / cols);
    const ox = ((cols - 1) * cell) / 2;
    const oz = ((rows - 1) * cell) / 2;
    list.forEach((u, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      out.set(`U${i}`, this.targetEntry(u, c * cell - ox, r * cell - oz, scale));
    });
    return out;
  }

  private targetEntry(u: PackedULD, cx: number, cz: number, scale: number) {
    const H = Math.max(0.2, u.height_m) * scale;
    return {
      cx, cz, L: u.length_m * scale, W: u.width_m * scale, H,
      uld_type: u.uld_type, fill: u.fill, n_units: u.n_units,
      slabs: u.contents.map((s) => ({
        item: s.item_index, color: this.color(s.item_index), count: s.count,
        y0f: u.height_m ? s.y0 / u.height_m : 0,
        y1f: u.height_m ? s.y1 / u.height_m : 0,
      })),
    };
  }

  private visibleBBox(): BBox {
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, any = false, a = 0;
    this.ulds.forEach((u) => {
      if (u.alpha < 0.05) return;
      any = true;
      a = Math.max(a, u.alpha);
      minX = Math.min(minX, u.cx - u.L / 2);
      maxX = Math.max(maxX, u.cx + u.L / 2);
      minZ = Math.min(minZ, u.cz - u.W / 2);
      maxZ = Math.max(maxZ, u.cz + u.W / 2);
    });
    if (!any) return { minX: -3, maxX: 3, minZ: -2, maxZ: 2, alpha: 0, any: false };
    return { minX, maxX, minZ, maxZ, alpha: a, any: true };
  }

  // ---- animation ----

  private step(u: AnimUld, t: number, dt: number): void {
    if (u.grow < 1) u.grow = clamp((t - u.spawnAt) / 320, 0, 1);
    const k = 1 - 0.0015 ** dt;
    u.cx = lerp(u.cx, u.tx, k);
    u.cz = lerp(u.cz, u.tz, k);
    u.L = lerp(u.L, u.tL, k);
    u.W = lerp(u.W, u.tW, k);
    u.H = lerp(u.H, u.tH, k);
    u.alpha = u.removing ? Math.max(0, u.alpha - dt * 4) : Math.min(1, lerp(u.alpha, easeOut(u.grow), k));
  }

  private computeFit(w: number, h: number, dt: number, hull: unknown, any: boolean): void {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, seen = false;
    const cam: CameraAngles = this.cam;
    const acc = (p: [number, number, number]): void => {
      seen = true;
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    };
    this.ulds.forEach((u) => {
      if (u.alpha < 0.02) return;
      for (const c of boxCorners(u.cx, u.cz, u.L, u.W, 0, u.H)) acc(projectRaw(c[0], c[1], c[2], w, h, cam));
    });
    if (seen && any) {
      for (const p of this.vehicle.fitPoints(hull)) acc(projectRaw(p[0], p[1], p[2], w, h, cam));
    }
    let tS: number, tCx: number, tCy: number;
    if (!seen) {
      tS = this.cam.zoom;
      tCx = w / 2;
      tCy = h / 2;
    } else {
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      tS = clamp(Math.min((w * 0.8) / bw, (h * 0.74) / bh), 0.05, 9) * this.cam.zoom;
      tCx = (minX + maxX) / 2;
      tCy = (minY + maxY) / 2;
    }
    const k = 1 - 0.0015 ** dt;
    this.fit.s = this.fit.s ? lerp(this.fit.s, tS, k) : tS;
    this.fit.cx = lerp(this.fit.cx, tCx, k);
    this.fit.cy = lerp(this.fit.cy, tCy, k);
  }

  private frame(t: number): void {
    t = t || now();
    const dt = Math.min(0.05, (t - this.prevT) / 1000 || 0.016);
    this.prevT = t;
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    const bw = Math.round(w * this.dpr);
    const bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }

    this.ulds.forEach((u, key) => {
      this.step(u, t, dt);
      if (u.removing && u.alpha <= 0.01) this.ulds.delete(key);
    });
    if (this.cam.autorotate && !this.dragging) this.cam.yaw += this.cam.speed;

    const bbox = this.visibleBBox();
    const hull = this.vehicle.bounds(bbox, this.dims);
    this.computeFit(w, h, dt, hull, bbox.any);

    const { ctx, theme } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (theme.background && theme.background !== "transparent") {
      ctx.fillStyle = theme.background;
      ctx.fillRect(0, 0, w, h);
    }

    const project = makeProject(w, h, this.cam, this.fit);
    drawGrid(ctx, project, theme);
    this.vehicle.draw(ctx, project, hull, theme);
    [...this.ulds.values()]
      .map((u) => ({ u, d: depth(u.cx, u.H / 2, u.cz, this.cam) }))
      .sort((a, b) => b.d - a.d)
      .forEach((o) => drawUld(ctx, project, o.u, theme));
    if (this.opts.labels) drawLabels(ctx, project, this.ulds.values(), theme, this.labelFn, h);

    this.raf = requestAnimationFrame((nt) => this.frame(nt));
  }

  // ---- DOM side-effects ----

  private renderLegend(): void {
    const el = this.opts.legendEl;
    if (!el || !this.opts.legend) return;
    el.innerHTML = this.legendItems
      .map((it, i) => {
        const d = it.description.length > 22 ? `${it.description.slice(0, 22)}…` : it.description;
        return `<span class="cargo-viz-chip"><i style="background:${this.color(i)}"></i>${esc(d)}</span>`;
      })
      .join("");
  }

  private renderCaption(ulds: PackedULD[]): void {
    const el = this.opts.captionEl;
    if (!el) return;
    const nu = ulds.reduce((a, u) => a + (u.n_units || 0), 0);
    el.textContent = ulds.length
      ? `${ulds.length} ULD${ulds.length === 1 ? "" : "s"} · ${nu} unit${nu === 1 ? "" : "s"} packed`
      : "";
  }

  // ---- interaction ----

  private bind(): void {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Document,
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ): void => {
      target.addEventListener(type, fn as EventListener, opts);
      this.cleanup.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };

    on(c, "pointerdown", (e) => {
      this.dragging = true;
      this.cam.autorotate = false;
      if (this.resumeT) clearTimeout(this.resumeT);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      c.setPointerCapture(e.pointerId);
    });
    on(c, "pointermove", (e) => {
      if (!this.dragging) return;
      this.cam.yaw += (e.clientX - this.lastX) * 0.01;
      this.cam.pitch = clamp(this.cam.pitch - (e.clientY - this.lastY) * 0.01, -1.3, 1.3);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    on(c, "pointerup", () => {
      this.dragging = false;
      if (this.resumeT) clearTimeout(this.resumeT);
      if (this.autoConfig) this.resumeT = setTimeout(() => (this.cam.autorotate = true), 2500);
    });
    on(c, "dblclick", () => this.resetCamera());
    on(c, "wheel", (e) => {
      e.preventDefault();
      this.cam.zoom = clamp(this.cam.zoom * (e.deltaY > 0 ? 1.08 : 0.93), this.cam.zoomMin, this.cam.zoomMax);
    }, { passive: false });
  }
}
