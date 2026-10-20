/**
 * KitchenPropMesh: builds one piece of the virtual kitchen stand-in (design brief,
 * "Stand-in for the preview") at runtime with MeshBuilder.
 *
 * Units are cm. Local origin = bottom centre of the prop (the floor point for the
 * table and oven). Containers open upwards (+Y). The oven front faces local +Z.
 * Colours are light and bright for the additive Specs display.
 *
 * Other scripts can call setHighlighted() for aim feedback and getTopHeight() to
 * place dose labels above the rim.
 */
import { MeshKit, RGBA, STRIDE, V3 } from "./MeshKit";

interface VesselSpec {
  /** Outer rim radius. */
  R: number;
  /** Height of the rim. */
  H: number;
  /** Wall thickness. */
  t: number;
  /** Outer radius at the base. */
  rb: number;
  /** 0 = straight tapered wall (pan, cup), 1 = rounded bowl. */
  curve: number;
  color: RGBA;
  segments: number;
}

// Containers: round, each a different colour and size (design brief, "Where things live").
const VESSELS: { [kind: string]: VesselSpec } = {
  mixingBowl: { R: 15, H: 12, t: 0.8, rb: 6.5, curve: 1, color: [0.96, 0.96, 0.93, 1], segments: 48 },
  flourBowl: { R: 13, H: 10, t: 0.7, rb: 6, curve: 1, color: [0.5, 0.78, 1, 1], segments: 48 },
  sugarBowl: { R: 9.5, H: 7.5, t: 0.6, rb: 4.5, curve: 1, color: [1, 0.6, 0.8, 1], segments: 40 },
  butterPan: { R: 8, H: 7, t: 0.45, rb: 7.4, curve: 0, color: [1, 0.62, 0.3, 1], segments: 40 },
  eggCup: { R: 4.5, H: 7, t: 0.4, rb: 3.4, curve: 0.25, color: [1, 0.92, 0.4, 1], segments: 32 },
  yolkCup: { R: 4, H: 4.5, t: 0.35, rb: 3.1, curve: 0.25, color: [0.68, 1, 0.45, 1], segments: 32 },
  bakingPowderDish: { R: 8, H: 2.2, t: 0.45, rb: 5.6, curve: 0.6, color: [0.78, 0.66, 1, 1], segments: 40 },
};

const FLOUR: RGBA = [0.98, 0.97, 0.93, 1];
const SUGAR: RGBA = [1, 0.99, 0.96, 1];
const BUTTER: RGBA = [1, 0.86, 0.38, 1];
const EGG_WHITE: RGBA = [0.97, 0.95, 0.86, 1];
const YOLK: RGBA = [1, 0.66, 0.12, 1];
const PAN_HANDLE: RGBA = [0.92, 0.84, 0.72, 1];
const SACHET: RGBA = [0.97, 0.96, 0.9, 1];
const SACHET_BAND: RGBA = [1, 0.35, 0.4, 1];

const TABLE_TOP: RGBA = [0.9, 0.76, 0.56, 1];
const TABLE_FRAME: RGBA = [0.78, 0.62, 0.44, 1];

const HIGHLIGHT_MIX = 0.35;

/** Outer radius of a vessel wall at normalised height u (0 = base, 1 = rim). */
function vesselRadius(v: VesselSpec, u: number): number {
  const round = 1 - (1 - u) * (1 - u);
  const s = u + (round - u) * v.curve;
  return v.rb + (v.R - v.rb) * s;
}

/** Hollow vessel profile: base centre, up the outside, over the rim, down the inside. */
function vesselProfile(v: VesselSpec, steps = 12): [number, number][] {
  const p: [number, number][] = [[0, 0]];
  for (let k = 0; k <= steps; k++) {
    const u = k / steps;
    p.push([vesselRadius(v, u), v.H * u]);
  }
  p.push([v.R - v.t * 0.5, v.H + v.t * 0.35]);
  for (let k = steps; k >= 0; k--) {
    const u = k / steps;
    p.push([vesselRadius(v, u) - v.t, v.t + (v.H - v.t) * u]);
  }
  p.push([0, v.t]);
  return p;
}

/** Height of the inner surface at fill fraction `fill`. */
function fillHeight(v: VesselSpec, fill: number): number {
  return v.t + (v.H - v.t) * fill;
}

/** Ingredient surface inside a vessel: a disk (mound = 0) or a soft heap. */
function addFill(kit: MeshKit, v: VesselSpec, fill: number, mound: number, color: RGBA): void {
  const y = fillHeight(v, fill);
  const r = vesselRadius(v, fill) - v.t * 0.6; // edge tucked into the wall thickness
  const prof: [number, number][] = [];
  const M = 8;
  for (let k = 0; k <= M; k++) {
    const q = 1 - k / M;
    prof.push([r * q, y + mound * (1 - q * q)]);
  }
  kit.lathe(prof, color, { segments: v.segments, capBottom: false, capTop: false });
}

/** Half-ellipsoid dome (egg yolk) resting at `center`. */
function addDome(kit: MeshKit, center: V3, r: number, h: number, color: RGBA): void {
  const prof: [number, number][] = [];
  const M = 8;
  for (let k = 0; k <= M; k++) {
    const a = (k / M) * (Math.PI / 2);
    prof.push([r * Math.cos(a), h * Math.sin(a)]);
  }
  kit.lathe(prof, color, { segments: 24, offset: center, capBottom: false, capTop: false });
}

/** C-shaped handle on the +X side of a cup; the open tube ends sit inside the wall. */
function addCupHandle(kit: MeshKit, v: VesselSpec): void {
  const yTop = v.H * 0.78, yBot = v.H * 0.3;
  const yMid = (yTop + yBot) / 2, b = (yTop - yBot) / 2, a = v.R * 0.55;
  const curve: V3[] = [];
  const N = 16;
  for (let k = 0; k <= N; k++) {
    const phi = Math.PI / 2 - (Math.PI * k) / N;
    const y = yMid + b * Math.sin(phi);
    const xw = vesselRadius(v, y / v.H) - 0.12;
    curve.push([xw + a * Math.cos(phi), y, 0]);
  }
  kit.tube(curve, Math.max(0.35, v.R * 0.09), 10, v.color);
}

function buildVessel(kit: MeshKit, kind: string): void {
  const v = VESSELS[kind];
  kit.lathe(vesselProfile(v), v.color, { segments: v.segments, capBottom: false, capTop: false });

  switch (kind) {
    case "flourBowl":
      addFill(kit, v, 0.45, 4.5, FLOUR);
      break;
    case "sugarBowl":
      addFill(kit, v, 0.5, 1.8, SUGAR);
      break;
    case "butterPan": {
      addFill(kit, v, 0.35, 0, BUTTER);
      const hy = v.H - 1.0, len = 13;
      const x0 = vesselRadius(v, hy / v.H) - 0.25;
      kit.box([x0 + len / 2, hy, 0], [len / 2, 0.55, 1.0], PAN_HANDLE);
      break;
    }
    case "eggCup": {
      const y = fillHeight(v, 0.65);
      addFill(kit, v, 0.65, 0.3, EGG_WHITE);
      addDome(kit, [0.4, y + 0.1, 0.4], 1.8, 1.1, YOLK);
      addCupHandle(kit, v);
      break;
    }
    case "yolkCup":
      addDome(kit, [0, v.t - 0.05, 0], 2.3, 1.6, YOLK);
      addCupHandle(kit, v);
      break;
    case "bakingPowderDish": {
      // Sachet of baking powder lying in the dish, with a coloured band at one end.
      const half: V3 = [2.8, 0.35, 4.2];
      const cy = v.t + half[1] + 0.02;
      kit.box([0.5, cy, -0.3], half, SACHET);
      kit.box([0.5, cy + half[1] + 0.03, -0.3 - half[2] + 1.3], [half[0], 0.03, 1.2], SACHET_BAND);
      break;
    }
    default:
      break; // mixingBowl stays empty: the flour "volcano" is made here.
  }
}

/** Rectangular kitchen table, 120 x 80 cm, 75 cm high. Origin = floor centre. */
function buildTable(kit: MeshKit): void {
  const W = 120, D = 80, H = 75, top = 3, leg = 5, inset = 4, apron = 7;
  kit.box([0, H - top / 2, 0], [W / 2, top / 2, D / 2], TABLE_TOP);
  const lx = W / 2 - inset - leg / 2, lz = D / 2 - inset - leg / 2;
  const legH = H - top;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      kit.box([sx * lx, legH / 2, sz * lz], [leg / 2, legH / 2, leg / 2], TABLE_FRAME);
    }
  }
  const ay = legH - apron / 2;
  for (const s of [-1, 1]) {
    kit.box([0, ay, s * lz], [lx - leg / 2, apron / 2, 1], TABLE_FRAME);
    kit.box([s * lx, ay, 0], [1, apron / 2, lz - leg / 2], TABLE_FRAME);
  }
}

/** Free-standing gas cooker with oven: 60 x 60 cm, cooktop at 86 cm. Front faces +Z. */
function buildOven(kit: MeshKit): void {
  const body: RGBA = [0.86, 0.87, 0.9, 1];
  const panel: RGBA = [0.72, 0.75, 0.8, 1];
  const door: RGBA = [0.92, 0.93, 0.95, 1];
  const glass: RGBA = [0.32, 0.38, 0.48, 1];
  const steel: RGBA = [0.97, 0.97, 0.98, 1];
  const cooktop: RGBA = [0.6, 0.62, 0.66, 1];
  const burner: RGBA = [0.5, 0.5, 0.53, 1];
  const grate: RGBA = [0.42, 0.42, 0.45, 1];
  const knob: RGBA = [0.62, 0.64, 0.68, 1];
  const mark: RGBA = [1, 1, 1, 1];
  const plinth: RGBA = [0.45, 0.46, 0.5, 1];

  // Carcass, recessed plinth, cooktop and backguard.
  kit.box([0, 45, 0], [30, 39, 29], body); // y 6..84
  kit.box([0, 3, -1], [28, 3, 27], plinth); // y 0..6
  kit.box([0, 85, 0], [30, 1, 30], cooktop); // y 84..86
  kit.box([0, 91, -29], [30, 5, 1], body); // y 86..96

  // Control strip with plain knobs: no numbers, just a pointer line.
  kit.box([0, 77.5, 29.3], [29, 5.5, 0.3], panel); // z 29..29.6
  const knobProfile: [number, number][] = [[2.3, 0], [2.3, 1.5], [2.1, 2.0], [1.5, 2.3], [0, 2.45]];
  for (const kx of [-22, -11, 0, 11, 22]) {
    kit.lathe(knobProfile, knob, { segments: 24, axis: "z", offset: [kx, 77.5, 29.6], capBottom: false });
    kit.box([kx, 78.55, 29.6 + 2.4], [0.25, 0.75, 0.15], mark);
  }

  // Oven door with window and bar handle. The oven timer UI goes on this door.
  kit.box([0, 39, 30], [28, 30, 1], door); // y 9..69, z 29..31
  kit.box([0, 42, 31.2], [20, 15, 0.2], glass); // y 27..57
  kit.box([0, 64, 34.5], [22, 1, 1], steel);
  for (const sx of [-1, 1]) kit.box([sx * 19, 64, 32.25], [0.8, 0.8, 1.25], steel);

  // Four burners with crossed pan supports.
  const burners: [number, number, number][] = [[-13, 12, 4.4], [13, 12, 3.6], [-13, -12, 3.6], [13, -12, 4.4]];
  for (const [bx, bz, br] of burners) {
    const prof: [number, number][] = [[br, 0], [br, 0.7], [br - 1, 1.0], [br - 1, 1.5], [br * 0.5, 1.7], [0, 1.8]];
    kit.lathe(prof, burner, { segments: 24, offset: [bx, 86, bz], capBottom: false });
    kit.box([bx, 88.2, bz], [6, 0.45, 0.5], grate);
    kit.box([bx, 88.2, bz], [0.5, 0.45, 6], grate);
  }
}

@component
export class KitchenPropMesh extends BaseScriptComponent {
  @input
  @hint("Which stand-in to build. Sizes and colours are in the preset tables at the top of this file.")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Table", "table"),
      new ComboBoxItem("Mixing bowl (empty)", "mixingBowl"),
      new ComboBoxItem("Flour bowl (large)", "flourBowl"),
      new ComboBoxItem("Sugar bowl (medium)", "sugarBowl"),
      new ComboBoxItem("Butter saucepan (small)", "butterPan"),
      new ComboBoxItem("Egg cup", "eggCup"),
      new ComboBoxItem("Yolk cup", "yolkCup"),
      new ComboBoxItem("Baking powder dish + sachet", "bakingPowderDish"),
      new ComboBoxItem("Gas oven", "oven"),
    ]),
  )
  kind: string = "mixingBowl";

  @input
  @hint("Vertex-colour material (vertexBaseColorMaterial from the SimpleVertexBaseColor package)")
  material: Material;

  private builder: MeshBuilder;
  private baseData: number[] = [];
  private visual: RenderMeshVisual;
  private highlighted = false;
  private topY = 0;
  private footprint = 0;

  onAwake(): void {
    const kit = new MeshKit();
    if (this.kind === "table") buildTable(kit);
    else if (this.kind === "oven") buildOven(kit);
    else if (VESSELS[this.kind]) buildVessel(kit, this.kind);
    else {
      print("KitchenPropMesh: unknown kind '" + this.kind + "', building mixingBowl");
      buildVessel(kit, "mixingBowl");
    }

    this.baseData = kit.data.slice();
    this.builder = kit.build();
    if (!this.builder.isValid()) {
      print("KitchenPropMesh: mesh for '" + this.kind + "' is not valid");
    }

    this.visual = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    this.visual.mesh = this.builder.getMesh();
    if (this.material) this.visual.mainMaterial = this.material;

    for (let o = 0; o < this.baseData.length; o += STRIDE) {
      const x = this.baseData[o], y = this.baseData[o + 1], z = this.baseData[o + 2];
      this.topY = Math.max(this.topY, y);
      this.footprint = Math.max(this.footprint, Math.hypot(x, z));
    }
  }

  /** Highest point of the prop in local cm (a container's rim). Dose labels go ~10 cm above. */
  getTopHeight(): number {
    return this.topY;
  }

  /** Largest horizontal distance from the local origin in cm (handles included). */
  getFootprintRadius(): number {
    return this.footprint;
  }

  getRenderMeshVisual(): RenderMeshVisual {
    return this.visual;
  }

  /** Brightens the whole prop towards white, e.g. while a hand or cursor aims at it. */
  setHighlighted(on: boolean): void {
    if (!this.builder || on === this.highlighted) return;
    this.highlighted = on;
    const v: number[] = new Array(STRIDE);
    const n = this.baseData.length / STRIDE;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE;
      for (let k = 0; k < STRIDE; k++) {
        const base = this.baseData[o + k];
        v[k] = on && k >= 6 && k <= 8 ? base + (1 - base) * HIGHLIGHT_MIX : base;
      }
      this.builder.setVertexInterleaved(i, v);
    }
    this.builder.updateMesh();
  }
}
