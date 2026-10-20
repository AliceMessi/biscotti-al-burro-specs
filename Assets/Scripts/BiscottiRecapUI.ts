/**
 * BiscottiRecapUI — the small recap strip low in view ("In forno: sotto, 3:20").
 *
 * Owns: the strip's look (UIKit BackPlate + FlexLayout row: timer icon | text).
 *       Drawn as an overlay (no depth test, later render order) so it stays readable
 *       when the follow point passes through the table while you look down at it.
 * Expects: to sit on the authored Recap SceneObject together with BiscottiLazyFollow,
 *          which moves it. The flow controller pushes text + visibility.
 * Must not: decide when it shows — BiscottiFlowController shows it only while a
 *           timer runs (or a notice is pending) AND the oven is out of view.
 *
 * Visibility = this SceneObject's `enabled` flag (Recap.enabled), or isVisible().
 */
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {
  applyTextRole,
  makeIcon,
  makeObject,
  makeText,
  mixColor,
  OVERLAY_RENDER_ORDER,
  rgb,
  silencePlate,
  stylePlate
} from "./BiscottiSharedUI"

const ICON_TIMER = requireAsset("../Icons/timer.png") as Texture

@component
export class BiscottiRecapUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiRecapUI – recap strip low in view</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(14, 45, 0.5))
  @hint("Strip width in cm")
  panelWidthCm: number = 27

  @input
  @widget(new SliderWidget(3, 12, 0.5))
  @hint("Strip height in cm")
  panelHeightCm: number = 5.5

  @input
  @widget(new SliderWidget(50, 200, 5))
  @hint("Follow distance in cm (keep in sync with BiscottiLazyFollow) — text scales with it")
  viewingDistanceCm: number = 100

  @input("vec3", "{0.35, 0.95, 0.9}")
  @widget(new ColorWidget())
  @hint("Strip accent colour")
  accentColor: vec3 = new vec3(0.35, 0.95, 0.9)
  @ui.group_end

  private plate: BackPlate
  private recapText: Text

  onAwake(): void {
    const W = this.panelWidthCm
    const H = this.panelHeightCm
    this.sceneObject.createComponent("Component.Canvas")

    this.plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    this.plate.size = new vec2(W, H)
    stylePlate(this.plate, {
      background: mixColor(rgb(this.accentColor, 0.9), new vec4(0.03, 0.05, 0.06, 0.9), 0.65),
      border: mixColor(rgb(this.accentColor), new vec4(1, 1, 1, 1), 0.15),
      borderSizeCm: 0.15,
      displayOnly: true,
      overlay: true
    })

    const content = makeObject(this.sceneObject, "Content", new vec3(0, 0, 0.3))
    const row = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    row.autoDiscoverItemsOnStart = false // items are registered explicitly via addItems()
    row.direction = FlexDirection.Row
    row.alignItems = FlexAlign.Center
    row.justifyContent = FlexJustify.Center
    row.columnGap = 0.8
    row.width = W
    row.height = H
    row.paddingLeft = 1
    row.paddingRight = 1

    const iconSize = H * 0.55
    const iconSO = makeObject(content, "RecapIcon")
    const icon = makeIcon(iconSO, ICON_TIMER, iconSize, false)
    icon.setRenderOrder(OVERLAY_RENDER_ORDER + 1)
    const iconItem = iconSO.createComponent(FlexItem.getTypeName()) as FlexItem
    iconItem.overrideWidth = iconSize
    iconItem.overrideHeight = iconSize

    const textW = W - iconSize - 0.8 - 2
    const textSO = makeObject(content, "RecapText")
    this.recapText = makeText(textSO, "", {align: "left", wrap: true, width: textW, height: H - 0.8, depthTest: false})
    applyTextRole(this.recapText, "Headline2", this.viewingDistanceCm)
    this.recapText.setRenderOrder(OVERLAY_RENDER_ORDER + 1)
    const textItem = textSO.createComponent(FlexItem.getTypeName()) as FlexItem
    textItem.overrideWidth = textW
    textItem.overrideHeight = H - 0.8

    row.addItems([iconItem, textItem])

    this.createEvent("UpdateEvent").bind(() => silencePlate(this.plate))
  }

  setVisible(visible: boolean): void {
    if (this.sceneObject.enabled !== visible) this.sceneObject.enabled = visible
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  setText(text: string): void {
    if (this.recapText && this.recapText.text !== text) this.recapText.text = text
  }

  get text(): string {
    return this.recapText ? this.recapText.text : ""
  }
}
