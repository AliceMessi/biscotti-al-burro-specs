/**
 * BiscottiSharedUI — shared UI-layer helpers for every Biscotti*UI module.
 *
 * Owns: the type scale (size + weight from one table), BackPlate theming for the
 *       additive display (mid-tone tinted glass + bright border, white text),
 *       "display-only" plates (collider / Interactable / InteractionPlane off so a
 *       label never blocks a pinch on the container behind it), icon images.
 * Expects: Assets/Materials/ImageMaterial.mat (created by the scene bootstrap).
 * Must not: hold state or make flow decisions. Used only by *UI.ts modules.
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {RoundedRectangle} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

// ── Typography: the single source of truth for text size + weight ────────────
// Text.size is the glyph EM-SQUARE height: em cm = size / 43.886.
// Sizes are the Snap Specs type scale at the 110 cm focal plane; pass the real
// viewing distance so text keeps the same angular size further away.
export const FONT_SIZE_SCALE = 1.0
export const EM_PER_SIZE_CM = 1 / 43.886

export type TextRole =
  | "Title1"
  | "Title2"
  | "HeadlineXL"
  | "Headline1"
  | "Headline2"
  | "Subheadline"
  | "Button"
  | "Callout"
  | "Body"
  | "Caption"

const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700},
  Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700},
  Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700},
  Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500},
  Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500},
  Caption: {size: 38, weight: 500}
}

export function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}

export function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

/** Text sized by its em height in cm (the brief's "text about 2 cm tall"). */
export function applyTextHeight(t: Text, emHeightCm: number, weight: number = 700): void {
  t.size = (emHeightCm / EM_PER_SIZE_CM) * FONT_SIZE_SCALE
  ;(t as Text & {weight?: number}).weight = weight
}

// ── SceneObject helpers ───────────────────────────────────────────────────────
export function makeObject(parent: SceneObject, name: string, localPos?: vec3): SceneObject {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  if (localPos) so.getTransform().setLocalPosition(localPos)
  return so
}

export interface TextOptions {
  wrap?: boolean
  align?: "left" | "center"
  color?: vec4
  /** Initial layout rect width/height (cm). Layouts may overwrite it. */
  width?: number
  height?: number
  depthTest?: boolean
}

/** Raw Component.Text with the skill's defaults (depthTest on, overflow-safe). */
export function makeText(so: SceneObject, value: string, opts: TextOptions = {}): Text {
  const t = so.createComponent("Component.Text") as Text
  t.text = value
  t.depthTest = opts.depthTest ?? true
  t.horizontalAlignment = opts.align === "left" ? HorizontalAlignment.Left : HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = opts.wrap ? HorizontalOverflow.Wrap : HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  const w = opts.width ?? 1
  const h = opts.height ?? 1
  t.layoutRect = Rect.create(-w / 2, w / 2, -h / 2, h / 2)
  t.textFill.color = opts.color ?? new vec4(1, 1, 1, 1)
  return t
}

/** Icon image with a cloned ImageMaterial (depth test on, depth write off). */
export function makeIcon(so: SceneObject, texture: Texture, sizeCm: number, depthTest: boolean = true): Image {
  const img = so.createComponent("Component.Image") as Image
  const mat = imageMaterial.clone()
  mat.mainPass.baseTex = texture
  mat.mainPass.depthTest = depthTest
  mat.mainPass.depthWrite = false
  img.clearMaterials()
  img.addMaterial(mat)
  so.getTransform().setLocalScale(new vec3(sizeCm, sizeCm, 1))
  return img
}

// ── BackPlate theming for the additive display ────────────────────────────────
export interface PlateStyle {
  /** Mid-tone tint: visible as coloured glass, never black. */
  background: vec4
  /** Bright rim that keeps the panel outline readable. */
  border: vec4
  borderSizeCm?: number
  /** Turn off the plate's collider / Interactable / InteractionPlane. */
  displayOnly?: boolean
  /** Draw on top of world geometry (HUD-style recap). */
  overlay?: boolean
}

export const OVERLAY_RENDER_ORDER = 200

export function stylePlate(plate: BackPlate, style: PlateStyle): void {
  plate.onInitialized.add(() => {
    const rr = plate.getSceneObject().getComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
    if (rr) {
      rr.gradient = false
      rr.backgroundColor = style.background
      rr.border = true
      rr.borderSize = style.borderSizeCm ?? 0.15
      rr.borderColor = style.border
      if (style.overlay) {
        rr.material.mainPass.depthTest = false
        rr.material.mainPass.depthWrite = false
        plate.renderOrder = OVERLAY_RENDER_ORDER // overlay case: separate HUD layer above the world
      }
    }
    if (style.displayOnly) silencePlate(plate)
  })
}

/**
 * BackPlate re-enables its collider/Interactable on every OnEnable, so display-only
 * modules call this again whenever they are shown (cheap and idempotent).
 */
export function silencePlate(plate: BackPlate): void {
  if (!plate || !plate.initialized) return
  const so = plate.getSceneObject()
  const collider = so.getComponent("Physics.ColliderComponent") as ColliderComponent
  if (collider && collider.enabled) collider.enabled = false
  const interactable = plate.interactable
  if (interactable && interactable.enabled) interactable.enabled = false
  const plane = plate.interactionPlane
  if (plane && plane.enabled) plane.enabled = false
}

/** Linear blend a → b. */
export function mixColor(a: vec4, b: vec4, t: number): vec4 {
  return new vec4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t)
}

export function rgb(v: vec3, alpha: number = 1): vec4 {
  return new vec4(v.x, v.y, v.z, alpha)
}
