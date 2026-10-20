/**
 * BiscottiDoseLabelUI — one dose label ("300 g di farina") floating above a container.
 *
 * Owns: the label's look (tinted BackPlate sized to the text, white text ~2 cm tall,
 *       faces the user via SIK Billboard). Display-only: never blocks a pinch.
 * Expects: to sit on the authored SceneObject DoseLabel_<Ingredient>, ~10 cm above
 *          the container rim. The flow controller pushes text + visibility.
 * Must not: decide when it shows — BiscottiFlowController owns that state.
 *
 * Visibility = this SceneObject's `enabled` flag, so DoseLabel_<X>.enabled is the
 * truth a test can read (or call isVisible()).
 */
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {applyTextHeight, makeObject, makeText, mixColor, rgb, silencePlate, stylePlate} from "./BiscottiSharedUI"

@component
export class BiscottiDoseLabelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiDoseLabelUI – dose label above a container</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec3", "{0.40, 0.70, 1.0}")
  @widget(new ColorWidget())
  @hint("Accent colour — match the container so label and container read as a pair")
  accentColor: vec3 = new vec3(0.4, 0.7, 1.0)

  @input
  @widget(new SliderWidget(1, 4, 0.1))
  @hint("Text height in cm (the brief asks for about 2 cm)")
  textHeightCm: number = 2.0

  @input
  @widget(new SliderWidget(8, 30, 0.5))
  @hint("Longest line before the dose wraps onto a second line (cm)")
  maxLineWidthCm: number = 18

  @input
  @hint("Turn the label to face the user's eyes (yaw + pitch)")
  faceUser: boolean = true
  @ui.group_end

  private plate: BackPlate
  private text: Text
  private needsFit = true

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    if (this.faceUser) {
      const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
      bb.xAxisEnabled = true
      bb.yAxisEnabled = true
    }

    // BackPlate first so the Canvas hierarchy pass paints it behind the text.
    this.plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    this.plate.size = new vec2(this.maxLineWidthCm, this.textHeightCm * 2)
    stylePlate(this.plate, {
      // Mid-tone tint of the container colour (reads as coloured glass on the
      // additive display) with a bright rim; the text itself is white.
      background: mixColor(rgb(this.accentColor, 0.92), new vec4(0.05, 0.05, 0.07, 0.92), 0.55),
      border: mixColor(rgb(this.accentColor), new vec4(1, 1, 1, 1), 0.2),
      borderSizeCm: 0.18,
      displayOnly: true
    })

    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    this.text = makeText(content, "", {wrap: true, width: this.maxLineWidthCm - 2, height: this.textHeightCm * 3})
    applyTextHeight(this.text, this.textHeightCm, 700)

    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  /** Dose text, verbatim from the recipe. */
  setText(value: string): void {
    if (!this.text) return
    if (this.text.text !== value) {
      this.text.text = value
      this.needsFit = true
    }
  }

  get labelText(): string {
    return this.text ? this.text.text : ""
  }

  setVisible(visible: boolean): void {
    if (this.sceneObject.enabled !== visible) {
      this.sceneObject.enabled = visible
      if (visible) this.needsFit = true
    }
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  private onUpdate(): void {
    silencePlate(this.plate)
    if (!this.needsFit || !this.text) return
    // Size the plate to the rendered text so short doses get short plates.
    const box = this.text.getBoundingBox()
    const size = box.getSize()
    if (size.x <= 0.01 || size.y <= 0.01) return
    const padX = this.textHeightCm * 0.7
    const padY = this.textHeightCm * 0.45
    this.plate.size = new vec2(size.x + padX * 2, size.y + padY * 2)
    const c = box.getCenter()
    this.text.getSceneObject().getTransform().setLocalPosition(new vec3(-c.x, -c.y, 0.6))
    this.needsFit = false
  }
}
