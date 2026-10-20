/**
 * BiscottiOvenTimerUI — the timer panel on the oven door (about 20 x 10 cm):
 * cooking phase ("Sotto" / "Sopra") and the countdown.
 *
 * Owns: the panel's look (UIKit BackPlate + FlexLayout row: icon | phase over time).
 * Expects: to sit on the authored OvenTimer SceneObject on the oven door. The flow
 *          controller pushes phase, time and visibility.
 * Must not: run the timer — BiscottiFlowController owns the countdown.
 *
 * Visibility = this SceneObject's `enabled` flag (OvenTimer.enabled), or isVisible().
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {applyTextRole, makeIcon, makeObject, makeText, mixColor, rgb, silencePlate, stylePlate} from "./BiscottiSharedUI"

const ICON_TIMER = requireAsset("../Icons/timer.png") as Texture

@component
export class BiscottiOvenTimerUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiOvenTimerUI – oven door timer</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(12, 40, 0.5))
  @hint("Panel width in cm (brief: about 20)")
  panelWidthCm: number = 20

  @input
  @widget(new SliderWidget(6, 20, 0.5))
  @hint("Panel height in cm (brief: about 10)")
  panelHeightCm: number = 10

  @input
  @widget(new SliderWidget(60, 250, 5))
  @hint("Typical viewing distance in cm — text scales to stay readable")
  viewingDistanceCm: number = 150

  @input("vec3", "{1.0, 0.62, 0.25}")
  @widget(new ColorWidget())
  @hint("Panel accent colour (warm = cooking)")
  accentColor: vec3 = new vec3(1.0, 0.62, 0.25)
  @ui.group_end

  private plate: BackPlate
  private phaseText: Text
  private timeText: Text

  onAwake(): void {
    const W = this.panelWidthCm
    const H = this.panelHeightCm
    const d = this.viewingDistanceCm
    this.sceneObject.createComponent("Component.Canvas")

    this.plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    this.plate.size = new vec2(W, H)
    stylePlate(this.plate, {
      background: mixColor(rgb(this.accentColor, 0.94), new vec4(0.05, 0.03, 0.02, 0.94), 0.6),
      border: mixColor(rgb(this.accentColor), new vec4(1, 1, 1, 1), 0.2),
      borderSizeCm: 0.2,
      displayOnly: true
    })

    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.6))
    const row = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems()
    row.direction = FlexDirection.Row
    row.alignItems = FlexAlign.Center
    row.justifyContent = FlexJustify.Center
    row.columnGap = 1.2
    row.width = W
    row.height = H
    row.paddingLeft = 1
    row.paddingRight = 1

    const iconSize = H * 0.42
    const iconSO = makeObject(content, "TimerIcon")
    makeIcon(iconSO, ICON_TIMER, iconSize)
    const iconItem = iconSO.createComponent(FlexItem.getTypeName()) as FlexItem
    iconItem.overrideWidth = iconSize
    iconItem.overrideHeight = iconSize

    const textW = W - iconSize - 1.2 - 2
    const texts = makeObject(content, "Texts")
    const col = texts.createComponent(FlexLayout.getTypeName()) as FlexLayout
    col.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems()
    col.direction = FlexDirection.Column
    col.alignItems = FlexAlign.Stretch
    col.justifyContent = FlexJustify.Center
    col.width = textW
    col.height = H - 1.6
    col.rowGap = 0.1
    const textsItem = texts.createComponent(FlexItem.getTypeName()) as FlexItem
    textsItem.overrideWidth = textW
    textsItem.overrideHeight = H - 1.6

    const phaseH = (H - 1.6) * 0.35
    const timeH = (H - 1.6) * 0.6
    const phaseSO = makeObject(texts, "PhaseText")
    this.phaseText = makeText(phaseSO, "Sotto", {align: "left", width: textW, height: phaseH, color: new vec4(1, 0.88, 0.65, 1)})
    applyTextRole(this.phaseText, "Headline2", d)
    const phaseItem = this.stretchItem(phaseSO, phaseH)

    const timeSO = makeObject(texts, "TimeText")
    this.timeText = makeText(timeSO, "5:00", {align: "left", width: textW, height: timeH})
    applyTextRole(this.timeText, "Title2", d)
    const timeItem = this.stretchItem(timeSO, timeH)

    col.addItems([phaseItem, timeItem])
    row.addItems([iconItem, textsItem])

    this.createEvent("UpdateEvent").bind(() => silencePlate(this.plate))
  }

  setVisible(visible: boolean): void {
    if (this.sceneObject.enabled !== visible) this.sceneObject.enabled = visible
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  setPhaseLabel(label: string): void {
    if (this.phaseText && this.phaseText.text !== label) this.phaseText.text = label
  }

  setTime(text: string): void {
    if (this.timeText && this.timeText.text !== text) this.timeText.text = text
  }

  get phaseString(): string {
    return this.phaseText ? this.phaseText.text : ""
  }

  get timeString(): string {
    return this.timeText ? this.timeText.text : ""
  }

  private stretchItem(so: SceneObject, height: number): FlexItem {
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = height
    item.alignSelf = FlexAlignSelf.Stretch
    item.flexShrink = 0
    return item
  }
}
