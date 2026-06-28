import type { Vehicle } from "./vehicle.js";
import { ship } from "./ship.js";
import { truck } from "./truck.js";
import { plane } from "./plane.js";

export type { Vehicle, VehicleDims, BBox } from "./vehicle.js";
export { ship, truck, plane };

export type VehicleName = "ship" | "truck" | "plane";

export const VEHICLES: Record<VehicleName, Vehicle> = { ship, truck, plane };

/** Resolve a preset name or a custom {@link Vehicle} into a Vehicle instance. */
export function resolveVehicle(v: VehicleName | Vehicle = "ship"): Vehicle {
  if (typeof v === "string") {
    const found = VEHICLES[v];
    if (!found) throw new Error(`Unknown vehicle preset: ${v}`);
    return found;
  }
  return v;
}
