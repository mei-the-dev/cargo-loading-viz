/** Camera + motion options exposed to consumers. */
export interface CameraOptions {
  /** Initial yaw (rotation around the vertical axis), radians. */
  yaw?: number;
  /** Initial pitch (tilt), radians. */
  pitch?: number;
  /** Initial zoom multiplier. */
  zoom?: number;
  /** Spin slowly when idle. */
  autorotate?: boolean;
  /** Autorotate angular speed, radians per frame. */
  speed?: number;
  /** Zoom clamp. */
  zoomMin?: number;
  zoomMax?: number;
  /** Enable drag-to-rotate, wheel-to-zoom, double-click reset. */
  interactive?: boolean;
}

/** Fully-resolved, mutable camera state held on a CargoViz instance. */
export interface CameraState {
  yaw: number;
  pitch: number;
  zoom: number;
  autorotate: boolean;
  speed: number;
  zoomMin: number;
  zoomMax: number;
  interactive: boolean;
}

export const DEFAULT_CAMERA: CameraState = {
  yaw: 0.6,
  pitch: -0.5,
  zoom: 1,
  autorotate: true,
  speed: 0.0028,
  zoomMin: 0.35,
  zoomMax: 3,
  interactive: true,
};

export function resolveCamera(opts: CameraOptions = {}): CameraState {
  return { ...DEFAULT_CAMERA, ...opts };
}
