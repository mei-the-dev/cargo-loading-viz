import { describe, expect, it } from "vitest";
import { depth, makeProject, projectRaw, rotate } from "../src/render/projection.js";

describe("projection math", () => {
  it("rotate is identity at zero angles", () => {
    expect(rotate(1, 2, 3, 0, 0)).toEqual([1, 2, 3]);
  });

  it("rotate yaw=π/2 maps +x toward +depth", () => {
    const [X, Y, Z] = rotate(1, 0, 0, Math.PI / 2, 0);
    expect(X).toBeCloseTo(0, 6);
    expect(Y).toBeCloseTo(0, 6);
    expect(Z).toBeCloseTo(1, 6);
  });

  it("projectRaw puts the world origin at canvas centre", () => {
    const [sx, sy, d] = projectRaw(0, 0, 0, 800, 600, { yaw: 0, pitch: 0 });
    expect(sx).toBeCloseTo(400, 6);
    expect(sy).toBeCloseTo(300, 6);
    expect(d).toBeCloseTo(0, 6);
  });

  it("makeProject folds the autofit transform", () => {
    const project = makeProject(800, 600, { yaw: 0, pitch: 0 }, { s: 1, cx: 400, cy: 300 });
    const [sx, sy] = project(0, 0, 0);
    expect(sx).toBeCloseTo(400, 6);
    expect(sy).toBeCloseTo(300, 6);
  });

  it("depth increases with camera-space Z", () => {
    expect(depth(0, 0, 1, { yaw: 0, pitch: 0 })).toBeCloseTo(1, 6);
    expect(depth(0, 0, -1, { yaw: 0, pitch: 0 })).toBeCloseTo(-1, 6);
  });
});
