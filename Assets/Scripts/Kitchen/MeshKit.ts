/**
 * MeshKit: small procedural-geometry helper on top of MeshBuilder.
 *
 * Vertex layout: position(3) normal(3) color(4), Triangles topology, UInt16 indices.
 * Every helper emits CCW triangles seen from outside, so default back-face culling works.
 * The vertex-colour material is unlit, so a simple key light + ambient is baked
 * into the vertex colours to make the shapes read as 3D.
 */
export type V3 = [number, number, number];
export type RGBA = [number, number, number, number];

/** Floats per vertex: 3 position + 3 normal + 4 colour. */
export const STRIDE = 10;

const LIGHT_DIR: V3 = normalize([0.35, 0.85, 0.4]);
const AMBIENT = 0.62;
const DIFFUSE = 0.38;
const MAX_VERTICES = 65535;

export function normalize(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export interface LatheOptions {
  /** Angular subdivisions (default 32). */
  segments?: number;
  /** Translation applied after revolving (cm). */
  offset?: V3;
  /** Revolve around +Y (default) or +Z (the profile height then runs along +Z). */
  axis?: "y" | "z";
  /** Close the first profile point with a disk when its radius is > 0 (default true). */
  capBottom?: boolean;
  /** Close the last profile point with a disk when its radius is > 0 (default true). */
  capTop?: boolean;
}

export class MeshKit {
  /** Interleaved vertex data with baked (unhighlighted) colours. */
  readonly data: number[] = [];
  private readonly indices: number[] = [];
  private count = 0;

  vertex(p: V3, n: V3, c: RGBA): number {
    const lambert = Math.max(0, n[0] * LIGHT_DIR[0] + n[1] * LIGHT_DIR[1] + n[2] * LIGHT_DIR[2]);
    const s = AMBIENT + DIFFUSE * lambert;
    this.data.push(
      p[0], p[1], p[2],
      n[0], n[1], n[2],
      Math.min(1, c[0] * s), Math.min(1, c[1] * s), Math.min(1, c[2] * s), c[3],
    );
    return this.count++;
  }

  /** Axis-aligned box with 4 vertices per face (face orders from the verified addBox helper). */
  box(center: V3, half: V3, color: RGBA): void {
    const x0 = center[0] - half[0], x1 = center[0] + half[0];
    const y0 = center[1] - half[1], y1 = center[1] + half[1];
    const z0 = center[2] - half[2], z1 = center[2] + half[2];
    const face = (p0: V3, p1: V3, p2: V3, p3: V3, n: V3) => {
      const a = this.vertex(p0, n, color);
      const b = this.vertex(p1, n, color);
      const c = this.vertex(p2, n, color);
      const d = this.vertex(p3, n, color);
      this.indices.push(a, b, c, a, c, d);
    };
    face([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
    face([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0]);
    face([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]);
    face([x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [0, -1, 0]);
    face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  }

  /**
   * Revolve a [radius, height] profile around the Y axis (or Z, see options).
   * The outward side of the surface is on the right of the profile direction:
   * walk up the outside of a vessel and back down the inside for a hollow bowl,
   * or from the rim inwards to the axis for a top-facing surface.
   */
  lathe(profile: [number, number][], color: RGBA, opts: LatheOptions = {}): void {
    const seg = opts.segments ?? 32;
    const off = opts.offset ?? [0, 0, 0];
    const zAxis = opts.axis === "z";
    // +90 deg about X maps the lathe's +Y onto +Z. A proper rotation keeps the winding.
    const rot = (x: number, y: number, z: number): V3 => (zAxis ? [x, -z, y] : [x, y, z]);
    const at = (x: number, y: number, z: number): V3 => {
      const r = rot(x, y, z);
      return [r[0] + off[0], r[1] + off[1], r[2] + off[2]];
    };

    const P = profile.length;
    const n2: [number, number][] = [];
    for (let j = 0; j < P; j++) {
      const prev = profile[Math.max(0, j - 1)];
      const next = profile[Math.min(P - 1, j + 1)];
      const dx = next[0] - prev[0], dy = next[1] - prev[1];
      const len = Math.hypot(dx, dy) || 1;
      n2.push([dy / len, -dx / len]);
    }

    const start = this.count;
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      for (let j = 0; j < P; j++) {
        const r = profile[j][0], y = profile[j][1];
        this.vertex(at(r * c, y, r * s), rot(n2[j][0] * c, n2[j][1], n2[j][0] * s), color);
      }
    }
    // (bl, br, tr, bl, tr, tl): cross product points along (dy, -dr), the profile's outward side.
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < P - 1; j++) {
        const bl = start + i * P + j, br = bl + 1;
        const tl = start + (i + 1) * P + j, tr = tl + 1;
        this.indices.push(bl, br, tr, bl, tr, tl);
      }
    }

    const cap = (r: number, y: number, up: boolean) => {
      const n = rot(0, up ? 1 : -1, 0);
      const center = this.vertex(at(0, y, 0), n, color);
      const ring = this.count;
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * Math.PI * 2;
        this.vertex(at(r * Math.cos(th), y, r * Math.sin(th)), n, color);
      }
      for (let i = 0; i < seg; i++) {
        if (up) this.indices.push(center, ring + i + 1, ring + i);
        else this.indices.push(center, ring + i, ring + i + 1);
      }
    };
    if ((opts.capBottom ?? true) && profile[0][0] > 1e-6) cap(profile[0][0], profile[0][1], false);
    if ((opts.capTop ?? true) && profile[P - 1][0] > 1e-6) cap(profile[P - 1][0], profile[P - 1][1], true);
  }

  /** Open tube of constant radius swept along a polyline (parallel-transport frames). */
  tube(curve: V3[], radius: number, radialSegments: number, color: RGBA): void {
    const N = curve.length;
    if (N < 2) return;

    const T: V3[] = [];
    for (let i = 0; i < N; i++) {
      const a = curve[Math.max(0, i - 1)], b = curve[Math.min(N - 1, i + 1)];
      T.push(normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]));
    }

    const ax: V3 = Math.abs(T[0][0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const d0 = ax[0] * T[0][0] + ax[1] * T[0][1] + ax[2] * T[0][2];
    let nf: V3 = normalize([ax[0] - d0 * T[0][0], ax[1] - d0 * T[0][1], ax[2] - d0 * T[0][2]]);

    const frames: { n: V3; b: V3 }[] = [];
    for (let i = 0; i < N; i++) {
      if (i > 0) {
        const tp = T[i - 1], tc = T[i];
        const kx = tp[1] * tc[2] - tp[2] * tc[1];
        const ky = tp[2] * tc[0] - tp[0] * tc[2];
        const kz = tp[0] * tc[1] - tp[1] * tc[0];
        const kl = Math.hypot(kx, ky, kz);
        if (kl > 1e-6) {
          const cosA = Math.max(-1, Math.min(1, tp[0] * tc[0] + tp[1] * tc[1] + tp[2] * tc[2]));
          const ang = Math.acos(cosA), s = Math.sin(ang), c = Math.cos(ang);
          const k: V3 = [kx / kl, ky / kl, kz / kl];
          const kxn: V3 = [k[1] * nf[2] - k[2] * nf[1], k[2] * nf[0] - k[0] * nf[2], k[0] * nf[1] - k[1] * nf[0]];
          const kdn = k[0] * nf[0] + k[1] * nf[1] + k[2] * nf[2];
          nf = [
            nf[0] * c + kxn[0] * s + k[0] * kdn * (1 - c),
            nf[1] * c + kxn[1] * s + k[1] * kdn * (1 - c),
            nf[2] * c + kxn[2] * s + k[2] * kdn * (1 - c),
          ];
        }
      }
      const t = T[i];
      const bf: V3 = [t[1] * nf[2] - t[2] * nf[1], t[2] * nf[0] - t[0] * nf[2], t[0] * nf[1] - t[1] * nf[0]];
      frames.push({ n: [nf[0], nf[1], nf[2]], b: bf });
    }

    const start = this.count;
    const R = radialSegments + 1;
    for (let i = 0; i < N; i++) {
      const p = curve[i], n = frames[i].n, b = frames[i].b;
      for (let j = 0; j < R; j++) {
        const th = (j / radialSegments) * Math.PI * 2;
        const c = Math.cos(th), s = Math.sin(th);
        const dir: V3 = [n[0] * c + b[0] * s, n[1] * c + b[1] * s, n[2] * c + b[2] * s];
        this.vertex([p[0] + dir[0] * radius, p[1] + dir[1] * radius, p[2] + dir[2] * radius], dir, color);
      }
    }
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const bl = start + i * R + j, br = bl + 1;
        const tl = start + (i + 1) * R + j, tr = tl + 1;
        this.indices.push(bl, br, tr, bl, tr, tl);
      }
    }
  }

  /** Creates the MeshBuilder, uploads all vertices and indices, and builds the mesh. */
  build(): MeshBuilder {
    if (this.count > MAX_VERTICES) {
      throw new Error("MeshKit: " + this.count + " vertices exceed the UInt16 index limit");
    }
    const builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 },
    ]);
    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;
    builder.appendVerticesInterleaved(this.data);
    builder.appendIndices(this.indices);
    builder.updateMesh();
    return builder;
  }
}
