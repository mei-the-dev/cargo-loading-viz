/** Visual theme: every colour and glow the renderer uses. */
export interface Theme {
  /** Per-item slab colours, cycled by `item_index`. */
  palette: string[];
  /** Neutral ULD container contour. */
  shell: string;
  /** Ground grid lines. */
  grid: string;
  /** Centre grid axis lines (brighter). */
  gridAxis: string;
  /** Canvas clear colour. */
  background: string;
  /** Vehicle hull stroke (body). */
  steel: string;
  /** Vehicle hull stroke (highlighted edges). */
  steelHi: string;
  /** Vehicle deck surface fill. */
  deckFill: string;
  /** Floor-shadow colour beneath each ULD. */
  shadow: string;
  /** shadowBlur amount for glowing strokes. */
  glow: number;
  /** Per-ULD label chip colours. */
  label: { bg: string; fg: string };
}

const PALETTE = [
  "#5cea97", "#6abdff", "#ff9e59", "#d97fff",
  "#66f2e6", "#ff7398", "#f2dc66", "#99ff73",
];

export const DARK_THEME: Theme = {
  palette: PALETTE,
  shell: "#cfe6dd",
  grid: "rgba(90,210,150,0.06)",
  gridAxis: "rgba(90,235,150,0.26)",
  background: "#0a0f0d",
  steel: "rgba(150,180,205,0.55)",
  steelHi: "rgba(180,210,230,0.85)",
  deckFill: "rgba(40,58,78,0.30)",
  shadow: "rgba(0,0,0,0.45)",
  glow: 7,
  label: { bg: "rgba(8,12,16,0.6)", fg: "rgba(228,244,236,0.96)" },
};

export const LIGHT_THEME: Theme = {
  palette: ["#1f9d57", "#1f76d9", "#e07b2e", "#9a3fd0", "#149e90", "#d63b66", "#bfa01f", "#4fa024"],
  shell: "#3a4a44",
  grid: "rgba(40,90,60,0.10)",
  gridAxis: "rgba(40,140,80,0.35)",
  background: "#eef3f0",
  steel: "rgba(70,95,120,0.55)",
  steelHi: "rgba(45,70,95,0.85)",
  deckFill: "rgba(150,175,200,0.30)",
  shadow: "rgba(20,40,30,0.18)",
  glow: 4,
  label: { bg: "rgba(245,250,247,0.85)", fg: "rgba(24,38,32,0.96)" },
};

export type ThemeInput = "dark" | "light" | Partial<Theme>;

/** Resolve a theme name or partial override into a full {@link Theme}. */
export function resolveTheme(input: ThemeInput = "dark"): Theme {
  if (input === "dark") return DARK_THEME;
  if (input === "light") return LIGHT_THEME;
  return { ...DARK_THEME, ...input, label: { ...DARK_THEME.label, ...input.label } };
}
