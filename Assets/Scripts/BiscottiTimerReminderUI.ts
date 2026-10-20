/**
 * BiscottiTimerReminderUI — the reminder bubble above the oven: "Manca 1 minuto",
 * "Mancano 30 secondi", and the end-of-phase instructions ("Ora cuoci sopra",
 * "Controlla: devono essere appena dorati").
 *
 * Owns: the bubble's look (UIKit BackPlate + FlexLayout row: bell icon | text),
 *       turned toward the user (SIK Billboard).
 * Expects: to sit on the authored TimerReminder SceneObject above the oven.
 * Must not: decide timing — BiscottiFlowController shows it 60 s / 30 s before the
 *           end of each phase, hides it ~10 s later, and shows the end notice.
 *
 * Visibility = this SceneObject's `enabled` flag (TimerReminder.enabled), or isVisible().
 */
import {Billboard} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Billboard/Billboard"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {applyTextRole, makeIcon, makeObject, makeText, mixColor, rgb, silencePlate, stylePlate} from "./BiscottiSharedUI"

const ICON_BELL = requireAsset("../Icons/notifications_active.png") as Texture

@component
export class BiscottiTimerReminderUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiTimerReminderUI – reminder bubble above the oven</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(16, 50, 0.5))
  @hint("Bubble width in cm")
  panelWidthCm: number = 30

  @input
  @widget(new SliderWidget(5, 16, 0.5))
  @hint("Bubble height in cm")
  panelHeightCm: number = 8

  @input
  @widget(new SliderWidget(60, 250, 5))
  @hint("Typical viewing distance in cm — text scales to stay readable")
  viewingDistanceCm: number = 140

  @input("vec3", "{1.0, 0.86, 0.3}")
  @widget(new ColorWidget())
  @hint("Bubble accent colour")
  accentColor: vec3 = new vec3(1.0, 0.86, 0.3)
  @ui.group_end

  private plate: BackPlate
  private messageText: Text

  onAwake(): void {
    const W = this.panelWidthCm
    const H = this.panelHeightCm
    this.sceneObject.createComponent("Component.Canvas")
    const bb = this.sceneObject.createComponent(Billboard.getTypeName()) as Billboard
    bb.xAxisEnabled = true
    bb.yAxisEnabled = true

    this.plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    this.plate.size = new vec2(W, H)
    stylePlate(this.plate, {
      background: mixColor(rgb(this.accentColor, 0.94), new vec4(0.05, 0.04, 0.02, 0.94), 0.62),
      border: mixColor(rgb(this.accentColor), new vec4(1, 1, 1, 1), 0.15),
      borderSizeCm: 0.22,
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
    row.paddingLeft = 1.2
    row.paddingRight = 1.2

    const iconSize = H * 0.5
    const iconSO = makeObject(content, "BellIcon")
    makeIcon(iconSO, ICON_BELL, iconSize)
    const iconItem = iconSO.createComponent(FlexItem.getTypeName()) as FlexItem
    iconItem.overrideWidth = iconSize
    iconItem.overrideHeight = iconSize

    const textW = W - iconSize - 1.2 - 2.4
    const textSO = makeObject(content, "ReminderText")
    this.messageText = makeText(textSO, "", {align: "left", wrap: true, width: textW, height: H - 1.2})
    applyTextRole(this.messageText, "HeadlineXL", this.viewingDistanceCm)
    const textItem = textSO.createComponent(FlexItem.getTypeName()) as FlexItem
    textItem.overrideWidth = textW
    textItem.overrideHeight = H - 1.2

    row.addItems([iconItem, textItem])

    this.createEvent("UpdateEvent").bind(() => silencePlate(this.plate))
  }

  show(text: string): void {
    if (this.messageText && this.messageText.text !== text) this.messageText.text = text
    if (!this.sceneObject.enabled) this.sceneObject.enabled = true
  }

  hide(): void {
    if (this.sceneObject.enabled) this.sceneObject.enabled = false
  }

  isVisible(): boolean {
    return this.sceneObject.enabled
  }

  get text(): string {
    return this.messageText ? this.messageText.text : ""
  }
}
