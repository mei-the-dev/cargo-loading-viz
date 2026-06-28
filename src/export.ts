/** Capture the live canvas animation to a WebM blob via the browser's MediaRecorder. */
export interface RecordOptions {
  /** How long to record, milliseconds. Default 6000. */
  durationMs?: number;
  /** Capture frame rate. Default 60. */
  fps?: number;
  /** Override the WebM codec; auto-selected (vp9 → vp8) when omitted. */
  mimeType?: string;
}

const CANDIDATES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c));
}

/**
 * Record `canvas` for `durationMs` and resolve a `video/webm` Blob.
 * Throws if MediaRecorder/captureStream is unavailable (non-browser / unsupported).
 */
export function recordWebM(canvas: HTMLCanvasElement, opts: RecordOptions = {}): Promise<Blob> {
  const { durationMs = 6000, fps = 60 } = opts;
  if (typeof MediaRecorder === "undefined" || typeof canvas.captureStream !== "function") {
    return Promise.reject(
      new Error("recordWebM: MediaRecorder/captureStream is not available in this environment"),
    );
  }
  const mime = opts.mimeType ?? pickMime();
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];

  return new Promise<Blob>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = (): void => {
      clearTimeout(timer);
      for (const track of stream.getTracks()) track.stop();
    };
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: mime || "video/webm" }));
    };
    rec.onerror = (e) => {
      cleanup();
      const detail = (e as Event & { error?: { message?: string } }).error?.message;
      reject(new Error(detail ? `recordWebM: ${detail}` : "recordWebM: MediaRecorder error"));
    };
    rec.start();
    timer = setTimeout(() => rec.stop(), durationMs);
  });
}
