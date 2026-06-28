import { describe, expect, it, vi } from "vitest";
import { CargoViz } from "../src/render/CargoViz.js";
import { unitize } from "../src/pack/unitize.js";
import { resolveTheme } from "../src/theme.js";
import { resolveCamera } from "../src/camera.js";
import { resolveVehicle, ship, truck, plane } from "../src/render/vehicles/index.js";

/** Minimal 2D context — records nothing, no-ops every call. */
function fakeCanvas(): HTMLCanvasElement {
  const ctx = new Proxy(
    { measureText: () => ({ width: 0 }) },
    { get: (t, p) => (p in t ? (t as Record<string, unknown>)[p as string] : () => undefined), set: () => true },
  );
  return {
    getContext: () => ctx,
    width: 800,
    height: 600,
    clientWidth: 800,
    clientHeight: 600,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    setPointerCapture: () => undefined,
  } as unknown as HTMLCanvasElement;
}

const SAMPLE = unitize([
  { description: "OLEO 209L", quantity: 4, volume_l: 209, packaging_form: "drum" },
  { description: "BIOCIDA", quantity: 2, volume_l: 25, packaging_form: "pail" },
]);

describe("resolvers", () => {
  it("merges a partial theme over the dark base", () => {
    const t = resolveTheme({ shell: "#fff" });
    expect(t.shell).toBe("#fff");
    expect(t.palette.length).toBeGreaterThan(0);
  });

  it("applies camera defaults", () => {
    expect(resolveCamera().autorotate).toBe(true);
    expect(resolveCamera({ autorotate: false }).autorotate).toBe(false);
  });

  it("resolves preset names and rejects unknown ones", () => {
    expect(resolveVehicle("truck")).toBe(truck);
    expect(resolveVehicle("plane")).toBe(plane);
    expect(resolveVehicle()).toBe(ship);
    // @ts-expect-error invalid preset
    expect(() => resolveVehicle("boat")).toThrow();
  });
});

describe("CargoViz lifecycle", () => {
  it("constructs, updates, and disposes without throwing", () => {
    const viz = new CargoViz(fakeCanvas(), { autoStart: false, camera: { interactive: false } });
    expect(() => viz.update(SAMPLE, [{ description: "OLEO 209L" }, { description: "BIOCIDA" }])).not.toThrow();
    expect(() => viz.setVehicle("plane")).not.toThrow();
    expect(() => viz.setTheme("light")).not.toThrow();
    expect(() => viz.resetCamera()).not.toThrow();
    expect(() => viz.dispose()).not.toThrow();
  });

  it("throws when the canvas has no 2D context", () => {
    const bad = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => new CargoViz(bad, { autoStart: false })).toThrow(/2D canvas context/);
  });

  it("rejects recordWebM when MediaRecorder is unavailable", async () => {
    const viz = new CargoViz(fakeCanvas(), { autoStart: false, camera: { interactive: false } });
    await expect(viz.recordWebM({ durationMs: 10 })).rejects.toThrow(/MediaRecorder/);
    viz.dispose();
  });

  it("runs an animation frame against a stubbed RAF", () => {
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const viz = new CargoViz(fakeCanvas(), { camera: { interactive: false } });
    viz.update(SAMPLE);
    expect(() => viz.dispose()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
