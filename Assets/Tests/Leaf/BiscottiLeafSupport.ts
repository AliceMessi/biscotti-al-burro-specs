/**
 * BiscottiLeafSupport — shared helpers for the "Biscotti al burro" LEAF scenarios.
 *
 * Test-only code. It reads Lens state (scene objects + BiscottiFlowController getters)
 * and drives input; it never changes Lens behaviour. The only Lens "write" APIs it uses
 * are the documented test helpers restart() and setTimeScale().
 *
 * Input modes (scenario parameter "input"):
 *   - "hand" (default): a LEAF simulated hand (SIK HandInteractor) moves to the target
 *     and pinches it. This is the real SIK pinch path: Interactable.onTriggerStart for
 *     containers, UIKit Button.onTriggerUp for "Fatto".
 *   - "sik": LEAF's DefaultLeafInteractor (SIK custom-controller interactor), still
 *     through SIK's InteractionManager, without a hand.
 *   - "api": BiscottiFlowController.confirmIngredient / pressFatto (no input at all).
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {LeafSingleHandInteractor} from "Leaf.lspkg/Interactors/interactor/handInput/LeafHandInteractor"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, nextFrame, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {LeafLifecycle} from "Leaf.lspkg/Utils/common/LeafLifecycle"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {BiscottiFlowController} from "../../Scripts/BiscottiFlowController"

// ── Expected content, verbatim from devpost/design-brief.md ─────────────────
export type IngredientKey = "flour" | "sugar" | "butter" | "egg" | "yolk" | "bakingPowder"

export interface ExpectedIngredient {
  id: IngredientKey
  container: string
  label: string
  dose: string
}

export const EXPECTED_INGREDIENTS: ExpectedIngredient[] = [
  {id: "flour", container: "Container_Flour", label: "DoseLabel_Flour", dose: "300 g di farina"},
  {id: "sugar", container: "Container_Sugar", label: "DoseLabel_Sugar", dose: "120 g di zucchero"},
  {id: "butter", container: "Container_Butter", label: "DoseLabel_Butter", dose: "125 g di burro (fuso)"},
  {id: "egg", container: "Container_Egg", label: "DoseLabel_Egg", dose: "1 uovo intero"},
  {id: "yolk", container: "Container_Yolk", label: "DoseLabel_Yolk", dose: "1 tuorlo, senza albume"},
  {id: "bakingPowder", container: "Container_BakingPowder", label: "DoseLabel_BakingPowder", dose: "1 bustina di lievito per dolci"}
]

export const EXPECTED_STEPS: string[] = [
  "Fai un vulcano con la farina e lo zucchero.",
  "Al centro metti l'uovo, il tuorlo e il lievito.",
  "Versa lentamente il burro nel vulcano e, con l'altra mano, mescola.",
  "Poco alla volta, aggiungi la farina fino a rendere l'impasto consistente.",
  "Forma una palla e mettila in frigorifero.",
  "Quando è fredda, metti un po' di farina sotto e dai all'impasto la forma che preferisci.",
  "Inforna: cuoci sotto per 5 minuti.",
  "Cuoci sopra per 5 minuti.",
  "Controlla: devono essere appena dorati."
]

/** 0-based index of step 7 ("Inforna: cuoci sotto per 5 minuti."). */
export const OVEN_STEP_INDEX = 6

export const DEFAULT_PARAMS: Record<string, string> = {input: "hand", hand: "left"}

// ── Logging ──────────────────────────────────────────────────────────────────
export function log(msg: string): void {
  print("[BiscottiLeaf] " + msg)
}

export function fmt(v: vec3): string {
  return "(" + v.x.toFixed(1) + ", " + v.y.toFixed(1) + ", " + v.z.toFixed(1) + ")"
}

// ── Scene lookup ────────────────────────────────────────────────────────────
export function requireObject(name: string): SceneObject {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`Scene object "${name}" not found`)
  return so
}

export function getController(): BiscottiFlowController {
  const root = requireObject("BiscottiAlBurro")
  const ctrl = root.getComponent(BiscottiFlowController.getTypeName()) as BiscottiFlowController
  if (!ctrl) throw new Error("BiscottiFlowController not found on BiscottiAlBurro")
  return ctrl
}

/** First Text component in the subtree of `root` (depth-first, includes disabled children). */
export function findText(root: SceneObject): Text | null {
  const t = root.getComponent("Component.Text") as Text
  if (t) return t
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const found = findText(root.getChild(i))
    if (found) return found
  }
  return null
}

/** Text shown by the Text component on (or under) the named object. */
export function textOf(name: string): string {
  const t = findText(requireObject(name))
  if (!t) throw new Error(`No Text component under "${name}"`)
  return t.text
}

export function worldPos(name: string): vec3 {
  return requireObject(name).getTransform().getWorldPosition()
}

/** World AABB of the RenderMeshVisual on the named object (its own mesh only). */
export function meshBounds(name: string): {min: vec3; max: vec3} {
  const rmv = requireObject(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (!rmv || !rmv.mesh) throw new Error(`"${name}" has no built mesh yet`)
  return {min: rmv.worldAabbMin(), max: rmv.worldAabbMax()}
}

/** "m:ss" → seconds, or -1 when the string does not match. */
export function parseClock(s: string): number {
  const m = /(\d+):(\d\d)$/.exec(s)
  if (!m) return -1
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

// ── Waiting ───────────────────────────────────────────────────────────────────
export async function waitFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await nextFrame()
}

/** Polls `pred` every frame until true; throws with `what` after `timeoutMs`. */
export async function waitUntil(pred: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const end = getTime() + timeoutMs / 1000
  while (!pred()) {
    if (getTime() > end) throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${what}`)
    await nextFrame()
  }
}

/**
 * Waits until the Lens is ready (controller started, runtime UI built, meshes given
 * time to build) and resets it to a clean state: step 1, no labels, no timer, timeScale 1.
 */
export async function prepareLens(): Promise<BiscottiFlowController> {
  // Runtime meshes take a few seconds after a preview reset.
  const lensAge = getTime()
  if (lensAge < 4) await sleep((4 - lensAge) * 1000)
  const ctrl = getController()
  await waitUntil(() => ctrl.getContainer("flour") !== null, 5000, "controller collected the containers")
  await waitUntil(() => !!findInteractableByName("FattoButton"), 5000, "FattoButton built at runtime")
  ctrl.setTimeScale(1)
  ctrl.restart()
  await waitFrames(3)
  return ctrl
}

/** Puts the Lens back to a clean state (always call in finally). */
export function cleanupLens(): void {
  try {
    const ctrl = getController()
    ctrl.setTimeScale(1)
    ctrl.restart()
  } catch (e) {
    log("cleanup: " + e)
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────
/** Per-scenario simulated hand. Destroyed by LEAF at scenario cleanup. */
class BiscottiHand extends LeafSingleHandInteractor {
  constructor(handType: "left" | "right") {
    super(handType, true)
  }
}

export type InputMode = "hand" | "sik" | "api"

/**
 * Drives the two inputs the brief defines: pinch a container, pinch "Fatto".
 * Each method returns after the input finished; callers assert the effect.
 */
export class BiscottiInput {
  readonly mode: InputMode
  readonly handType: "left" | "right"
  private hand: BiscottiHand | null = null
  private sik: DefaultLeafInteractor | null = null

  constructor(config?: ScenarioConfig) {
    const m = config ? config.get("input") : undefined
    this.mode = m === "sik" || m === "api" ? m : "hand"
    const h = config ? config.get("hand") : undefined
    this.handType = h === "right" ? "right" : "left"
    log(`input mode: ${this.describe()}`)
  }

  describe(): string {
    if (this.mode === "hand") return `hand (LEAF simulated ${this.handType} hand pinch via SIK HandInteractor)`
    if (this.mode === "sik") return "sik (LEAF DefaultLeafInteractor via SIK InteractionManager)"
    return "api (BiscottiFlowController calls, no input)"
  }

  private async trigger(target: Interactable, what: string): Promise<void> {
    if (this.mode === "hand") {
      if (!this.hand) this.hand = new BiscottiHand(this.handType)
      await withTimeout(this.hand.trigger(target), 8000, `pinch on ${what} did not complete within 8 s`)
    } else {
      if (!this.sik) this.sik = new DefaultLeafInteractor("BiscottiLeafSikInteractor")
      await withTimeout(this.sik.trigger(target), 8000, `SIK trigger on ${what} did not complete within 8 s`)
    }
  }

  async pinchContainer(ing: ExpectedIngredient): Promise<void> {
    if (this.mode === "api") {
      getController().confirmIngredient(ing.id)
      return
    }
    const target = findInteractableByName(ing.container)
    if (!target) throw new Error(`No Interactable on ${ing.container}`)
    await this.trigger(target, ing.container)
  }

  async pressFatto(): Promise<void> {
    if (this.mode === "api") {
      getController().pressFatto()
      return
    }
    const target = findInteractableByName("FattoButton")
    if (!target) throw new Error("No Interactable on FattoButton")
    await this.trigger(target, "FattoButton")
  }

  /** Moves the simulated hand out of view (used by the demo tour so it doesn't cover the UI). */
  async rest(): Promise<void> {
    if (this.hand) await this.hand.hand.hide(450)
  }
}

/**
 * Presses "Fatto" until the card shows `targetIndex` (0-based), asserting that each
 * press advances exactly one step.
 */
export async function advanceToStep(input: BiscottiInput, targetIndex: number): Promise<void> {
  const ctrl = getController()
  while (ctrl.stepIndex < targetIndex) {
    const before = ctrl.stepIndex
    await input.pressFatto()
    await waitUntil(() => ctrl.stepIndex === before + 1, 3000, `step ${before + 2} after pressing Fatto`)
  }
}

// ── Head pose (camera) ──────────────────────────────────────────────────────────
/**
 * Simulated head: holds the world camera at a test pose, the same way LEAF's
 * TrackedHandWrapper simulates a hand (it disables the hand's ObjectTracking3D and
 * drives the hand itself). Here the camera's DeviceTracking is paused while a pose is
 * held, otherwise the preview's device tracking overwrites the camera every frame.
 * The pose is re-applied every Update and LateUpdate. Release / scenario cleanup
 * re-enables DeviceTracking and puts the camera back.
 */
export class HeadPose {
  readonly camera: Camera
  readonly camT: Transform
  private readonly startPos: vec3
  private readonly startRot: quat
  private readonly tracking: DeviceTracking | null
  private trackingPaused = false
  private pose: {pos: vec3; rot: quat} | null = null
  private holder: SceneObject | null
  private applyCount = 0
  private readonly unsubscribe: () => void

  constructor() {
    const camObj = requireObject("Camera Object")
    this.camera = camObj.getComponent("Component.Camera") as Camera
    this.camT = camObj.getTransform()
    this.tracking = (camObj.getComponent("Component.DeviceTracking") as DeviceTracking) || null
    this.startPos = this.camT.getWorldPosition()
    this.startRot = this.camT.getWorldRotation()

    this.holder = global.scene.createSceneObject("BiscottiLeafHeadPose")
    this.holder.setParent(camObj)
    const sc = this.holder.createComponent("Component.ScriptComponent") as ScriptComponent
    const apply = () => {
      if (!this.pose) return
      this.applyCount++
      this.camT.setWorldPosition(this.pose.pos)
      this.camT.setWorldRotation(this.pose.rot)
    }
    sc.createEvent("UpdateEvent").bind(apply)
    sc.createEvent("LateUpdateEvent").bind(apply)
    this.unsubscribe = LeafLifecycle.getInstance().onCleanup.add(() => this.release())
  }

  /** Stand at `eye` and look at `target` (camera looks down its local -Z). */
  look(eye: vec3, target: vec3): void {
    if (this.tracking && this.tracking.enabled) {
      this.tracking.enabled = false
      this.trackingPaused = true
    }
    const rot = quat.lookAt(eye.sub(target).normalize(), vec3.up())
    this.pose = {pos: eye, rot: rot}
    this.camT.setWorldPosition(eye)
    this.camT.setWorldRotation(rot)
  }

  /** Camera-space metrics of a world point: distance, degrees below/right of view centre. */
  metrics(p: vec3): {dist: number; belowDeg: number; rightDeg: number; inView: boolean} {
    const eye = this.camT.getWorldPosition()
    const rel = p.sub(eye)
    const fwd = rel.dot(this.camT.back)
    const down = rel.dot(this.camT.down)
    const right = rel.dot(this.camT.right)
    return {
      dist: rel.length,
      belowDeg: (Math.atan2(down, fwd) * 180) / Math.PI,
      rightDeg: (Math.atan2(right, fwd) * 180) / Math.PI,
      inView: this.camera.isSphereVisible(p, 1)
    }
  }

  /** One-line dump of the camera pose vs. the held pose, for failure evidence. */
  describe(point: vec3, radius: number): string {
    const p = this.camT.getWorldPosition()
    const r = this.camT.getWorldRotation()
    const held = this.pose
      ? `held pos ${fmt(this.pose.pos)} rot (${this.pose.rot.w.toFixed(3)}, ${this.pose.rot.x.toFixed(3)}, ${this.pose.rot.y.toFixed(3)}, ${this.pose.rot.z.toFixed(3)})`
      : "no held pose"
    const m = this.metrics(point)
    return (
      `camera pos ${fmt(p)} rot (${r.w.toFixed(3)}, ${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)}); ${held}; ` +
      `point ${fmt(point)} is ${m.dist.toFixed(1)} cm away, ${m.belowDeg.toFixed(1)} deg below, ${m.rightDeg.toFixed(1)} deg right; ` +
      `camera.isSphereVisible(point, ${radius}) seen by the test = ${this.camera.isSphereVisible(point, radius)}; fov=${((this.camera.fov * 180) / Math.PI).toFixed(1)} deg; ` +
      `DeviceTracking.enabled=${this.tracking ? this.tracking.enabled : "n/a"}; pose applied ${this.applyCount}x`
    )
  }

  /** Stop holding and put the camera back where it was. Idempotent. */
  release(): void {
    this.pose = null
    if (this.trackingPaused && this.tracking) {
      this.tracking.enabled = true
      this.trackingPaused = false
    }
    if (this.holder) {
      this.camT.setWorldPosition(this.startPos)
      this.camT.setWorldRotation(this.startRot)
      this.holder.destroy()
      this.holder = null
      this.unsubscribe()
    }
  }
}
