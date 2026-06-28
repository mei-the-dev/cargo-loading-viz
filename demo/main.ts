import { CargoViz, type Item, unitize, type VehicleName } from "../src/index.ts";

const FLEETS: Record<string, Item[]> = {
  "Offshore PSV": [
    { description: "OLEO 209L OMALA S2 G220", quantity: 6, volume_l: 209, packaging_form: "drum" },
    { description: "BIOCIDA THPS75", quantity: 4, volume_l: 25, packaging_form: "pail" },
    { description: "KIT DE DISCO RIGIDO", quantity: 3, volume_l: 18, packaging_form: "box" },
    { description: "IBC AGUA POTAVEL", quantity: 2, volume_l: 1000, packaging_form: "ibc" },
    { description: "CABO DE ACO 5/8", quantity: 1, volume_l: 140, packaging_form: "coil" },
  ],
  "Retail pallets": [
    { description: "Cereal cartons", quantity: 40, volume_l: 32, packaging_form: "carton" },
    { description: "Beverage cases", quantity: 24, volume_l: 18, packaging_form: "case" },
    { description: "Appliance boxes", quantity: 8, volume_l: 120, packaging_form: "box" },
    { description: "Pallet of paper", quantity: 4, volume_l: 600, packaging_form: "pallet" },
  ],
  "Air freight": [
    { description: "Pharma cooler", quantity: 6, volume_l: 60, packaging_form: "box" },
    { description: "Electronics", quantity: 30, volume_l: 14, packaging_form: "carton" },
    { description: "Spare engine part", quantity: 1, volume_l: 9000, packaging_form: "crate" },
    { description: "Courier documents", quantity: 12, volume_l: 5, packaging_form: "box" },
  ],
};

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;
const canvas = $("#viz") as HTMLCanvasElement;

const viz = new CargoViz(canvas, {
  vehicle: "ship",
  theme: "dark",
  legend: true,
  legendEl: $("#legend"),
  captionEl: $("#caption"),
});

// ---- cargo editing ----
const serialize = (items: Item[]): string =>
  items.map((i) => `${i.description} | ${i.quantity} | ${i.volume_l} | ${i.packaging_form ?? ""}`).join("\n");

function parse(text: string): Item[] {
  return text
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter((c) => c[0])
    .map((c) => ({
      description: c[0]!,
      quantity: Math.max(1, parseInt(c[1] ?? "1", 10) || 1),
      volume_l: Math.max(0.1, parseFloat(c[2] ?? "1") || 1),
      packaging_form: c[3] || undefined,
    }));
}

const editor = $("#editor") as HTMLTextAreaElement;
let timer: ReturnType<typeof setTimeout>;
function pushFromEditor(): void {
  const items = parse(editor.value);
  viz.update(unitize(items), items);
}
editor.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(pushFromEditor, 250);
});

function loadFleet(name: string): void {
  editor.value = serialize(FLEETS[name]!);
  pushFromEditor();
}

// ---- sample-cargo chips ----
const fleets = $("#fleets");
Object.keys(FLEETS).forEach((name, i) => {
  const b = document.createElement("button");
  b.textContent = name;
  if (i === 0) b.classList.add("is-on");
  b.addEventListener("click", () => {
    fleets.querySelectorAll("button").forEach((x) => x.classList.remove("is-on"));
    b.classList.add("is-on");
    loadFleet(name);
  });
  fleets.appendChild(b);
});

// ---- segmented controls ----
function segmented(id: string, onPick: (value: string) => void): void {
  const group = $(`#${id}`);
  group.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      group.querySelectorAll("button").forEach((x) => x.classList.remove("is-on"));
      btn.classList.add("is-on");
      onPick(btn.dataset[id] ?? "");
    });
  });
}

segmented("vehicle", (v) => viz.setVehicle(v as VehicleName));
segmented("theme", (t) => {
  document.documentElement.dataset.theme = t;
  viz.setTheme(t as "dark" | "light");
});

$<HTMLInputElement>("#autorotate").addEventListener("change", (e) =>
  viz.setAutorotate((e.target as HTMLInputElement).checked),
);
$<HTMLInputElement>("#labels").addEventListener("change", (e) =>
  viz.setLabelsVisible((e.target as HTMLInputElement).checked),
);

// ---- record ----
const recordBtn = $<HTMLButtonElement>("#record");
recordBtn.addEventListener("click", async () => {
  recordBtn.disabled = true;
  const original = recordBtn.textContent;
  recordBtn.textContent = "● Recording…";
  try {
    const blob = await viz.recordWebM({ durationMs: 5000 });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cargo-loading.webm";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Recording unavailable: ${(err as Error).message}`);
  } finally {
    recordBtn.disabled = false;
    recordBtn.textContent = original;
  }
});

// ---- boot ----
loadFleet("Offshore PSV");
