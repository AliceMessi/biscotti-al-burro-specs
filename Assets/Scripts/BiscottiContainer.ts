/**
 * BiscottiContainer — makes one ingredient container pinchable (SIK Interactable).
 *
 * Owns: the container's hit box (a padded box collider on a runtime "Hitbox" child,
 *       so small cups are still big targets), aim highlight (prop brightens + a
 *       glowing ring on the table), and the pinch → onPinched(ingredientId) signal.
 * Expects (@input): the KitchenPropMesh on this object, the authored HoverRing child,
 *       and the DoseLabel_<X> UI under this container.
 * Must not: decide when the dose label shows — it forwards the pinch to
 *       BiscottiFlowController, which owns that state and calls setDoseVisible().
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BiscottiDoseLabelUI} from "./BiscottiDoseLabelUI"
import {KitchenPropMesh} from "./Kitchen/KitchenPropMesh"

@component
export class BiscottiContainer extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiContainer – pinchable ingredient container</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The stand-in mesh builder on this container (brightens while aimed at)")
  prop: KitchenPropMesh

  @input
  @hint("Glowing ring on the table, shown while the container is aimed at")
  hoverRing: SceneObject

  @input
  @hint("This container's dose label (DoseLabel_<Ingredient>)")
  doseLabel: BiscottiDoseLabelUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Which ingredient this container holds (hard-coded association for the preview stand-in)")
  @widget(
    new ComboBoxWidget([
      new ComboBoxItem("Flour", "flour"),
      new ComboBoxItem("Sugar", "sugar"),
      new ComboBoxItem("Butter (melted)", "butter"),
      new ComboBoxItem("Whole egg", "egg"),
      new ComboBoxItem("Yolk", "yolk"),
      new ComboBoxItem("Baking powder", "bakingPowder")
    ])
  )
  ingredientId: string = "flour"

  @input
  @widget(new SliderWidget(6, 30, 0.5))
  @hint("Smallest hit-box width/depth in cm — small cups still get a big target")
  minTargetSizeCm: number = 15

  @input
  @hint("Draw the hit box as a wireframe (debug)")
  debugCollider: boolean = false
  @ui.group_end

  private interactable: Interactable
  private collider: ColliderComponent
  private hitbox: SceneObject
  private aimed = false
  private onPinchedEvent = new Event<string>()

  /** Fires with this container's ingredientId when the user pinches (or clicks) it. */
  get onPinched(): PublicApi<string> {
    return this.onPinchedEvent.publicApi()
  }

  onAwake(): void {
    // Hit box on a child so it can be centred on the vessel (origin is the base).
    this.hitbox = global.scene.createSceneObject("Hitbox")
    this.hitbox.setParent(this.sceneObject)
    this.collider = this.hitbox.createComponent("Physics.ColliderComponent") as ColliderComponent
    this.collider.fitVisual = false
    const shape = Shape.createBoxShape()
    shape.size = new vec3(this.minTargetSizeCm, this.minTargetSizeCm, this.minTargetSizeCm)
    this.collider.shape = shape
    this.collider.debugDrawEnabled = this.debugCollider

    // Interactable created after the collider so SIK finds it in this hierarchy.
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable

    if (this.hoverRing) this.hoverRing.enabled = false

    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    if (!this.prop || !this.doseLabel) {
      print("[BiscottiContainer] " + this.sceneObject.name + ": prop / doseLabel input not wired")
    }
    this.fitHitbox()

    this.interactable.onHoverEnter.add(() => this.setAimed(true))
    this.interactable.onHoverExit.add(() => this.setAimed(false))
    this.interactable.onTriggerStart.add(() => this.onPinchedEvent.invoke(this.ingredientId))
  }

  /** Same path as a real pinch (used by tests and the optional voice input). */
  pinch(): void {
    this.onPinchedEvent.invoke(this.ingredientId)
  }

  setDoseText(text: string): void {
    if (this.doseLabel) this.doseLabel.setText(text)
  }

  setDoseVisible(visible: boolean): void {
    if (this.doseLabel) this.doseLabel.setVisible(visible)
  }

  isDoseVisible(): boolean {
    return this.doseLabel ? this.doseLabel.isVisible() : false
  }

  isAimed(): boolean {
    return this.aimed
  }

  private setAimed(on: boolean): void {
    this.aimed = on
    if (this.prop) this.prop.setHighlighted(on)
    if (this.hoverRing) this.hoverRing.enabled = on
  }

  /** Size the box to the vessel's mesh bounds, padded up to minTargetSizeCm. */
  private fitHitbox(): void {
    let min = new vec3(-5, 0, -5)
    let max = new vec3(5, 8, 5)
    const rmv = this.prop ? this.prop.getRenderMeshVisual() : null
    if (rmv && rmv.mesh) {
      min = rmv.localAabbMin()
      max = rmv.localAabbMax()
    }
    const size = max.sub(min)
    const center = min.add(max).uniformScale(0.5)
    const s = new vec3(
      Math.max(size.x + 2, this.minTargetSizeCm),
      Math.max(size.y + 4, this.minTargetSizeCm * 0.75),
      Math.max(size.z + 2, this.minTargetSizeCm)
    )
    const shape = Shape.createBoxShape()
    shape.size = s
    this.collider.shape = shape
    // Keep the bottom of the box on the table, grow upward.
    this.hitbox.getTransform().setLocalPosition(new vec3(center.x, min.y + s.y / 2, center.z))
  }
}
