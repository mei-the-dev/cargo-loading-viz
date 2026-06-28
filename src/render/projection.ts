/** Camera + projection math: look down onto the deck. Pure functions, unit-tested. */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** Maps a world point (x up the deck length, y up, z across the beam) → [screenX, screenY, depth]. */
export type Project = (x: number, y: number, z: number) => Vec3;

export interface CameraAngles {
  yaw: number;
  pitch: number;
}

export interface FitState {
  s: number;
  cx: number;
  cy: number;
}

/** Rotate a world point by yaw (around Y) then pitch (around X). */
export function rotate(x: number, y: number, z: number, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const X = x * cy - z * sy;
  let Z = x * sy + z * cy;
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const Y = y * cx - Z * sx;
  Z = y * sx + Z * cx;
  return [X, Y, Z];
}

/** Depth (camera-space Z) of a world point — used to back-to-front sort the ULDs. */
export function depth(x: number, y: number, z: number, cam: CameraAngles): number {
  return rotate(x, y, z, cam.yaw, cam.pitch)[2];
}

/** Perspective projection before the autofit transform is applied. */
export function projectRaw(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  cam: CameraAngles,
): Vec3 {
  const [X, Y, Z] = rotate(x, y, z, cam.yaw, cam.pitch);
  const f = (Math.min(w, h) * 0.64) / (Z + 9.5);
  return [w / 2 + X * f, h / 2 - Y * f, Z];
}

/** Build a frame-local projector that folds the autofit transform onto {@link projectRaw}. */
export function makeProject(w: number, h: number, cam: CameraAngles, fit: FitState): Project {
  return (x, y, z) => {
    const p = projectRaw(x, y, z, w, h, cam);
    return [(p[0] - fit.cx) * fit.s + w / 2, (p[1] - fit.cy) * fit.s + h / 2, p[2]];
  };
}
