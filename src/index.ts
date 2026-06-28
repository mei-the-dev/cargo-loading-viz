/** cargo-loading-viz — framework-agnostic core. */
export { CargoViz } from "./render/CargoViz.js";
export type { CargoVizOptions, LegendItem } from "./render/CargoViz.js";

export { unitize } from "./pack/unitize.js";
export type { Content, Item, PackedULD, UldSpec, UnitizeOptions } from "./pack/types.js";
export { ETA, SELF_DIMS, SELF_ULD_FORMS, ULD_CATALOG, volCapL } from "./pack/specs.js";

export { DARK_THEME, LIGHT_THEME, resolveTheme } from "./theme.js";
export type { Theme, ThemeInput } from "./theme.js";

export { resolveCamera } from "./camera.js";
export type { CameraOptions, CameraState } from "./camera.js";

export { plane, resolveVehicle, ship, truck, VEHICLES } from "./render/vehicles/index.js";
export type { BBox, Vehicle, VehicleDims, VehicleName } from "./render/vehicles/index.js";

export { recordWebM } from "./export.js";
export type { RecordOptions } from "./export.js";

export type { AnimUld, LabelFn, Slab } from "./render/uld.js";
export type { Project, Vec2, Vec3 } from "./render/projection.js";
