/**
 * BiscottiStepCardUI — the step card (about 30 x 15 cm) with the big round "Fatto"
 * button right beside it, at the back edge of the table, tilted toward the user.
 *
 * Owns: the card's look and layout (UIKit BackPlate + FlexLayout column for
 *       header / step text / status, UIKit Button for "Fatto").
 * Expects: to sit on the authored StepStation SceneObject. The flow controller
 *          pushes the step text and whether "Fatto" is enabled.
 * Must not: advance the recipe itself — it only emits onFatto (passive view).
 *
 * Runtime objects a test can find by name: "StepCard", "StepText", "HeaderText",
 * "StatusText", "FattoButton" (a UIKit Button, so it is an SIK Interactable).
 *
 * Size note (~280 lines): card + button stay together because the brief places the
 * button "right beside the step card"; ~40 lines are the button's bright theming.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {ElementContent} from "SpectaclesUIKit.lspkg/Scripts/Components/Content/ElementContent"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {GradientParameters} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"
import {applyTextRole, makeObject, makeText, mixColor, rgb, roleSize, stylePlate} from "./BiscottiSharedUI"

const ICON_CHECK = requireAsset("../Icons/check.png") as Texture

const PAD = 1.3
const GAP = 0.4
const HEADER_H = 2.2
const STATUS_H = 1.8

/** Vertical two-stop gradient (top → bottom) for the Fatto button face. */
function vGrad(top: vec4, bottom: vec4): GradientParameters {
  return {
    enabled: true,
    type: "Linear",
    start: new vec2(0, 1),
    end: new vec2(0, -1),
    stop0: {enabled: true, percent: 0, color: top},
    stop1: {enabled: true, percent: 1, color: bottom}
  }
}

@component
export class BiscottiStepCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiStepCardUI – step card + "Fatto" button</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(20, 45, 0.5))
  @hint("Card width in cm (brief: about 30)")
  cardWidthCm: number = 30

  @input
  @widget(new SliderWidget(10, 25, 0.5))
  @hint("Card height in cm (brief: about 15)")
  cardHeightCm: number = 15

  @input
  @widget(new SliderWidget(5, 14, 0.5))
  @hint("Diameter of the round Fatto button in cm (brief: about 8)")
  buttonDiameterCm: number = 8

  @input
  @widget(new SliderWidget(60, 220, 5))
  @hint("Distance from the user's eyes in cm — text scales to stay the same apparent size")
  viewingDistanceCm: number = 140

  @input("vec3", "{0.22, 0.62, 0.72}")
  @widget(new ColorWidget())
  @hint("Card tint (shown as coloured glass, with a brighter rim)")
  cardColor: vec3 = new vec3(0.22, 0.62, 0.72)

  @input("vec3", "{1.0, 0.66, 0.2}")
  @widget(new ColorWidget())
  @hint("Fatto button colour (bright and warm so it reads on the additive display); also tints the step header")
  buttonColor: vec3 = new vec3(1.0, 0.66, 0.2)
  @ui.group_end

  private headerText: Text
  private bodyText: Text
  private statusText: Text
  private fattoButton: Button
  private fattoEnabled = true
  private onFattoEvent = new Event<void>()

  /** Fires when the user presses "Fatto". */
  get onFatto(): PublicApi<void> {
    return this.onFattoEvent.publicApi()
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")

    const row = makeObject(this.sceneObject, "Row")
    const rowFlex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    rowFlex.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems()
    rowFlex.direction = FlexDirection.Row
    rowFlex.alignItems = FlexAlign.Center
    rowFlex.justifyContent = FlexJustify.Center
    rowFlex.columnGap = 2
    rowFlex.width = -1
    rowFlex.height = -1

    const cardItem = this.buildCard(row)
    const buttonItem = this.buildButton(row)
    rowFlex.addItems([cardItem, buttonItem])
  }

  // ── Public API (called by BiscottiFlowController) ──────────────────────────
  setStep(header: string, body: string): void {
    if (this.headerText && this.headerText.text !== header) this.headerText.text = header
    if (this.bodyText && this.bodyText.text !== body) this.bodyText.text = body
  }

  setStatus(text: string): void {
    if (this.statusText && this.statusText.text !== text) this.statusText.text = text
  }

  setFattoEnabled(enabled: boolean): void {
    if (this.fattoEnabled === enabled) return
    this.fattoEnabled = enabled
    if (this.fattoButton) this.fattoButton.inactive = !enabled
  }

  get stepText(): string {
    return this.bodyText ? this.bodyText.text : ""
  }

  get headerString(): string {
    return this.headerText ? this.headerText.text : ""
  }

  get statusString(): string {
    return this.statusText ? this.statusText.text : ""
  }

  isFattoEnabled(): boolean {
    return this.fattoEnabled
  }

  // ── Build ────────────────────────────────────────────────────────────────
  private buildCard(row: SceneObject): FlexItem {
    const W = this.cardWidthCm
    const H = this.cardHeightCm
    const d = this.viewingDistanceCm

    const card = makeObject(row, "StepCard")
    const plate = card.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(W, H)
    stylePlate(plate, {
      background: mixColor(rgb(this.cardColor, 0.94), new vec4(0.04, 0.05, 0.06, 0.94), 0.55),
      border: mixColor(rgb(this.cardColor), new vec4(1, 1, 1, 1), 0.35),
      borderSizeCm: 0.2,
      displayOnly: true
    })
    const cardItem = card.createComponent(FlexItem.getTypeName()) as FlexItem
    cardItem.overrideWidth = W
    cardItem.overrideHeight = H

    // Content after the plate (hierarchy order = paint order), lifted to avoid z-fighting.
    const content = makeObject(card, "Content", new vec3(0, 0, 0.6))
    const col = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems()
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.justifyContent = FlexJustify.Start
    col.width = W
    col.height = H
    col.rowGap = GAP
    col.paddingTop = PAD
    col.paddingBottom = PAD
    col.paddingLeft = PAD
    col.paddingRight = PAD

    const innerW = W - PAD * 2
    const bodyH = H - PAD * 2 - HEADER_H - STATUS_H - GAP * 2

    const header = makeObject(content, "HeaderText")
    this.headerText = makeText(header, "", {align: "left", width: innerW, height: HEADER_H, color: mixColor(rgb(this.buttonColor), new vec4(1, 1, 1, 1), 0.35)})
    applyTextRole(this.headerText, "Headline2", d)
    const headerItem = this.columnItem(header, HEADER_H)

    const body = makeObject(content, "StepText")
    this.bodyText = makeText(body, "", {align: "left", wrap: true, width: innerW, height: bodyH})
    applyTextRole(this.bodyText, "Headline1", d)
    const bodyItem = this.columnItem(body, bodyH)

    const status = makeObject(content, "StatusText")
    this.statusText = makeText(status, "", {align: "left", width: innerW, height: STATUS_H, color: new vec4(0.65, 0.95, 1, 1)})
    applyTextRole(this.statusText, "Subheadline", d)
    const statusItem = this.columnItem(status, STATUS_H)

    col.addItems([headerItem, bodyItem, statusItem])
    return cardItem
  }

  private themeButton(btn: Button): void {
    const vis = btn.visual as RoundedRectangleVisual
    if (!vis) return
    const top = rgb(this.buttonColor)
    const bottom = mixColor(rgb(this.buttonColor), new vec4(0.55, 0.18, 0.02, 1), 0.45)
    const hoverTop = mixColor(top, new vec4(1, 1, 1, 1), 0.3)
    const hoverBottom = mixColor(bottom, new vec4(1, 0.85, 0.5, 1), 0.35)
    const rim = mixColor(top, new vec4(1, 1, 1, 1), 0.55)
    vis.defaultBaseType = "Gradient"
    vis.hoveredBaseType = "Gradient"
    vis.triggeredBaseType = "Gradient"
    vis.inactiveBaseType = "Gradient"
    vis.defaultGradient = vGrad(top, bottom)
    vis.hoveredGradient = vGrad(hoverTop, hoverBottom)
    vis.triggeredGradient = vGrad(bottom, bottom)
    vis.inactiveGradient = vGrad(new vec4(0.32, 0.3, 0.27, 1), new vec4(0.22, 0.2, 0.18, 1))
    vis.defaultHasBorder = true
    vis.hoveredHasBorder = true
    vis.triggeredHasBorder = true
    vis.inactiveHasBorder = true
    vis.defaultBorderType = "Color"
    vis.hoveredBorderType = "Color"
    vis.triggeredBorderType = "Color"
    vis.inactiveBorderType = "Color"
    vis.defaultBorderSize = 0.15
    vis.hoveredBorderSize = 0.3
    vis.triggeredBorderSize = 0.3
    vis.inactiveBorderSize = 0.1
    vis.borderDefaultColor = rim
    vis.borderHoveredColor = new vec4(1, 1, 1, 1)
    vis.borderTriggeredColor = new vec4(1, 1, 1, 1)
    vis.borderInactiveColor = new vec4(0.5, 0.48, 0.44, 1)
  }

  private columnItem(so: SceneObject, height: number): FlexItem {
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = height
    item.alignSelf = FlexAlignSelf.Stretch
    item.flexShrink = 0
    return item
  }

  private buildButton(row: SceneObject): FlexItem {
    const D = this.buttonDiameterCm
    const so = makeObject(row, "FattoButton")
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setVariant({theme: "SnapOS2", shape: "Round", style: "Primary"})
    btn.size = new vec3(D, D, 1) // before init

    // The button face is a single ElementContent (icon above the word), so companion mode is safe.
    const ec = so.createComponent(ElementContent.getTypeName()) as ElementContent
    ec.text = "Fatto"
    ec.leadingIcon = ICON_CHECK
    ec.iconLayout = "top"
    ec.leadingIconSize = D * 0.4
    ec.spacing = D * 0.02
    ec.textSize = roleSize("HeadlineXL", this.viewingDistanceCm) * (D / 8) * 0.9

    // Bright, warm face (UIKit styles are dark fills by design; the brief asks for a big,
    // bright target that highlights when aimed at). Inactive = dim while the oven runs.
    btn.onInitialized.add(() => this.themeButton(btn))

    btn.onTriggerUp.add(() => {
      if (this.fattoEnabled) this.onFattoEvent.invoke()
    })
    this.fattoButton = btn

    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = D
    item.overrideHeight = D
    return item
  }
}
