import { type CSSProperties, useEffect, useRef } from "react";
import type { PackedULD } from "../pack/types.js";
import { CargoViz as Core, type CargoVizOptions, type LegendItem } from "../render/CargoViz.js";

export interface CargoVizProps extends CargoVizOptions {
  ulds: PackedULD[];
  items?: LegendItem[];
  className?: string;
  style?: CSSProperties;
  /** Receive the underlying imperative instance once mounted. */
  onReady?: (viz: Core) => void;
}

/**
 * React wrapper around the core {@link Core} class. Instantiates once, then pushes
 * data and a few reactive options through the imperative API on prop changes.
 */
export function CargoViz({ ulds, items, className, style, onReady, ...options }: CargoVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vizRef = useRef<Core | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // init once; options captured at mount, reactive ones reapplied below
  useEffect(() => {
    if (!canvasRef.current) return;
    const viz = new Core(canvasRef.current, options);
    vizRef.current = viz;
    onReadyRef.current?.(viz);
    return () => {
      viz.dispose();
      vizRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    vizRef.current?.update(ulds, items ?? []);
  }, [ulds, items]);

  useEffect(() => {
    if (options.vehicle !== undefined) vizRef.current?.setVehicle(options.vehicle);
  }, [options.vehicle]);

  useEffect(() => {
    if (options.vehicleDims !== undefined) vizRef.current?.setVehicleDims(options.vehicleDims);
  }, [options.vehicleDims]);

  useEffect(() => {
    if (options.theme !== undefined) vizRef.current?.setTheme(options.theme);
  }, [options.theme]);

  useEffect(() => {
    if (options.labels !== undefined) vizRef.current?.setLabelsVisible(options.labels);
  }, [options.labels]);

  return <canvas ref={canvasRef} className={className} style={style} />;
}
