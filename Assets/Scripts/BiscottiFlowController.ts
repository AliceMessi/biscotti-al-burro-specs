/**
 * BiscottiFlowController — the ONE owner of the recipe flow (main entry script).
 *
 * Owns all flow state: current step, which ingredients were confirmed, which dose
 * labels show, the oven timer (phase, remaining seconds, reminders, end notices),
 * whether the oven is in the camera's view, and whether the recap shows. Every
 * UI module is a passive view: this script pushes state into them each frame.
 *
 * Expects (@input): the world camera, the Table (parent of the Container_* objects),
 *   the StepStation / OvenTimer / TimerReminder / Recap UI modules and BiscottiAudio.
 * Must not: build UI or hold view state — that lives in the Biscotti*UI modules.
 *
 * Test API (LEAF): getState(), stepIndex, timerPhase, remainingSeconds,
 *   isDoseLabelVisible(id), isRecapVisible, isOvenInView, pressFatto(),
 *   confirmIngredient(id), restart(), setTimeScale(n). Set `timeScale` > 1 to run
 *   the 5 + 5 minute timers faster (test-only; 1 = real time).
 *
 * Size note (~450 lines): kept as ONE file on purpose — the brief asks for all flow
 * state in a single controller a test can read. About a third is the read-only test
 * API (getters + getState); the recipe text lives in BiscottiRecipe.ts.
 */
import {BiscottiAudio} from "./BiscottiAudio"
import {BiscottiContainer} from "./BiscottiContainer"
import {BiscottiOvenTimerUI} from "./BiscottiOvenTimerUI"
import {BiscottiRecapUI} from "./BiscottiRecapUI"
import {
  BOTTOM_PHASE_STEP,
  CHECK_STEP,
  findIngredient,
  formatClock,
  OvenPhase,
  STEPS,
  TEXT,
  TOP_PHASE_STEP
} from "./BiscottiRecipe"
import {BiscottiStepCardUI} from "./BiscottiStepCardUI"
import {BiscottiTimerReminderUI} from "./BiscottiTimerReminderUI"

/** Seconds a dose label stays up when you re-pinch a container whose step is done. */
const RECHECK_LABEL_SEC = 6

export interface BiscottiFlowState {
  stepIndex: number
  stepNumber: number
  stepCount: number
  stepText: string
  finished: boolean
  fattoEnabled: boolean
  timerPhase: OvenPhase
  timerRunning: boolean
  remainingSeconds: number
  ovenTimerVisible: boolean
  ovenTimerText: string
  reminderVisible: boolean
  reminderText: string
  noticeText: string
  ovenInView: boolean
  recapVisible: boolean
  recapText: string
  confirmedIngredients: string[]
  visibleDoseLabels: string[]
  timeScale: number
}

@component
export class BiscottiFlowController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">BiscottiFlowController – recipe flow, oven timer, recap</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("World camera — decides whether the oven is in view (real view frustum)")
  camera: Camera

  @input
  @hint("Parent of the Container_* objects (the Table); containers are found under it")
  ingredientsRoot: SceneObject

  @input
  @hint("Step card + Fatto button (StepStation)")
  stepCard: BiscottiStepCardUI

  @input
  @hint("Timer panel on the oven door (OvenTimer)")
  ovenTimer: BiscottiOvenTimerUI

  @input
  @hint("Reminder bubble above the oven (TimerReminder)")
  timerReminder: BiscottiTimerReminderUI

  @input
  @hint("Recap strip low in view (Recap)")
  recap: BiscottiRecapUI

  @input
  @hint("Sound cues (Audio)")
  audio: BiscottiAudio
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SpinBoxWidget(0, 600, 1))
  @hint("TEST-ONLY time scale for the oven timers: 1 = real time (5 + 5 minutes). LEAF sets e.g. 30 to check reminders fast")
  timeScale: number = 1

  @input
  @widget(new SpinBoxWidget(10, 1800, 10))
  @hint("Length of each cooking phase in seconds (recipe: 5 minutes)")
  phaseDurationSec: number = 300

  @input
  @widget(new SpinBoxWidget(0, 600, 5))
  @hint("First reminder: seconds before the end of a phase")
  firstReminderSec: number = 60

  @input
  @widget(new SpinBoxWidget(0, 600, 5))
  @hint("Second reminder: seconds before the end of a phase")
  secondReminderSec: number = 30

  @input
  @widget(new SliderWidget(2, 30, 1))
  @hint("How long a reminder stays up (timer seconds)")
  reminderVisibleSec: number = 10

  @input
  @widget(new SliderWidget(1, 40, 1))
  @hint("Radius (cm) around the oven timer that must be inside the camera view for the oven to count as 'in view'")
  ovenViewRadiusCm: number = 10
  @ui.group_end

  // ── State (single source of truth) ────────────────────────────────────────
  private containers: BiscottiContainer[] = []
  private _stepIndex = 0
  private _finished = false
  private confirmed: {[id: string]: boolean} = {}
  private recheckUntil: {[id: string]: number} = {}
  private _phase: OvenPhase = "none"
  private _remaining = 0
  private firstFired = false
  private secondFired = false
  private reminderLeft = 0
  private _reminderText = ""
  private _notice = ""
  private _ovenInView = false
  private realTime = 0
  private started = false

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    const missing: string[] = []
    if (!this.camera) missing.push("camera")
    if (!this.ingredientsRoot) missing.push("ingredientsRoot")
    if (!this.stepCard) missing.push("stepCard")
    if (!this.ovenTimer) missing.push("ovenTimer")
    if (!this.timerReminder) missing.push("timerReminder")
    if (!this.recap) missing.push("recap")
    if (missing.length > 0) {
      print("[Biscotti] ERROR: inputs not wired: " + missing.join(", "))
    }

    if (this.ingredientsRoot) this.collectContainers(this.ingredientsRoot)
    for (const c of this.containers) {
      const ing = findIngredient(c.ingredientId)
      if (!ing) {
        print("[Biscotti] WARN: unknown ingredientId '" + c.ingredientId + "' on " + c.getSceneObject().name)
        continue
      }
      c.setDoseText(ing.dose)
      c.onPinched.add((id: string) => this.confirmIngredient(id))
    }
    if (this.stepCard) this.stepCard.onFatto.add(() => this.pressFatto())

    print("[Biscotti] ready: " + this.containers.length + " containers, " + STEPS.length + " steps")
    this.started = true
    this.refreshViews()
  }

  private collectContainers(root: SceneObject): void {
    const c = root.getComponent(BiscottiContainer.getTypeName()) as BiscottiContainer
    if (c) this.containers.push(c)
    const n = root.getChildrenCount()
    for (let i = 0; i < n; i++) this.collectContainers(root.getChild(i))
  }

  // ── Actions (the same paths the pinch / button use) ──────────────────────
  /** Pinch on a container: confirm the ingredient and show its dose label. */
  confirmIngredient(id: string): void {
    const ing = findIngredient(id)
    if (!ing) return
    this.confirmed[id] = true
    if (this._stepIndex > ing.lastUseStep || this._finished) {
      this.recheckUntil[id] = this.realTime + RECHECK_LABEL_SEC
    }
    if (this.audio) this.audio.playConfirm()
    print("[Biscotti] confirmed " + id + " -> " + ing.dose)
    this.refreshViews()
  }

  /** "Fatto": next step; on the oven steps it starts the timer. Returns false if locked. */
  pressFatto(): boolean {
    if (this._finished || this._phase !== "none") return false
    if (this.audio) this.audio.playFatto()
    if (this._stepIndex === BOTTOM_PHASE_STEP) {
      this.startPhase("sotto")
    } else if (this._stepIndex === TOP_PHASE_STEP) {
      this.startPhase("sopra")
    } else if (this._stepIndex >= CHECK_STEP) {
      this._finished = true
      this._notice = ""
      print("[Biscotti] recipe finished")
    } else {
      this._stepIndex++
      print("[Biscotti] step " + (this._stepIndex + 1) + ": " + STEPS[this._stepIndex])
    }
    this.refreshViews()
    return true
  }

  /** Back to step 1, no timer, no labels (test helper). */
  restart(): void {
    this._stepIndex = 0
    this._finished = false
    this.confirmed = {}
    this.recheckUntil = {}
    this._phase = "none"
    this._remaining = 0
    this.reminderLeft = 0
    this._reminderText = ""
    this._notice = ""
    print("[Biscotti] restart")
    this.refreshViews()
  }

  /** TEST-ONLY: speed up (or slow down) the oven timers. */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, scale)
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  private startPhase(phase: OvenPhase): void {
    this._phase = phase
    this._remaining = this.phaseDurationSec
    this.firstFired = this.phaseDurationSec <= this.firstReminderSec
    this.secondFired = this.phaseDurationSec <= this.secondReminderSec
    this.reminderLeft = 0
    this._notice = ""
    print("[Biscotti] oven phase '" + phase + "' started (" + this.phaseDurationSec + " s, timeScale " + this.timeScale + ")")
  }

  private fireReminder(secondsLeft: number): void {
    this._reminderText = TEXT.reminder(secondsLeft)
    this.reminderLeft = this.reminderVisibleSec
    if (this.audio) this.audio.playReminder()
    print("[Biscotti] reminder: " + this._reminderText)
  }

  private endPhase(): void {
    const ended = this._phase
    this._phase = "none"
    this._remaining = 0
    this.reminderLeft = 0
    if (ended === "sotto") {
      this._notice = TEXT.noticeAfterBottom
      this._stepIndex = TOP_PHASE_STEP
    } else {
      this._notice = TEXT.noticeAfterTop
      this._stepIndex = CHECK_STEP
    }
    if (this.audio) this.audio.playPhaseEnd()
    print("[Biscotti] oven phase '" + ended + "' ended -> " + this._notice)
  }

  private onUpdate(): void {
    if (!this.started) return
    const dt = getDeltaTime()
    this.realTime += dt
    const simDt = dt * Math.max(0, this.timeScale)

    if (this._phase !== "none") {
      this._remaining -= simDt
      if (!this.firstFired && this._remaining <= this.firstReminderSec) {
        this.firstFired = true
        this.fireReminder(this.firstReminderSec)
      }
      if (!this.secondFired && this._remaining <= this.secondReminderSec) {
        this.secondFired = true
        this.fireReminder(this.secondReminderSec)
      }
      if (this._remaining <= 0) this.endPhase()
    }
    if (this.reminderLeft > 0) this.reminderLeft -= simDt

    this._ovenInView = this.computeOvenInView()
    this.refreshViews()
  }

  /** Real camera frustum test against a sphere around the oven timer. */
  private computeOvenInView(): boolean {
    if (!this.camera || !this.ovenTimer) return false
    const p = this.ovenTimer.getSceneObject().getTransform().getWorldPosition()
    return this.camera.isSphereVisible(p, this.ovenViewRadiusCm)
  }

  // ── Derived view state ────────────────────────────────────────────────────
  private doseVisible(id: string): boolean {
    if (!this.confirmed[id]) return false
    if (this.realTime < (this.recheckUntil[id] ?? -1)) return true
    if (this._finished) return false
    const ing = findIngredient(id)
    return ing !== null && this._stepIndex <= ing.lastUseStep
  }

  private get reminderActive(): boolean {
    return this._phase !== "none" && this.reminderLeft > 0
  }

  private get reminderVisibleNow(): boolean {
    return this.reminderActive || this._notice !== ""
  }

  private get recapVisibleNow(): boolean {
    return !this._ovenInView && (this._phase !== "none" || this._notice !== "")
  }

  private get recapString(): string {
    if (this._phase !== "none") return TEXT.recapRunning(this._phase, formatClock(this._remaining))
    return this._notice
  }

  private refreshViews(): void {
    for (const c of this.containers) c.setDoseVisible(this.doseVisible(c.ingredientId))

    if (this.stepCard) {
      if (this._finished) {
        this.stepCard.setStep(TEXT.finishedHeader, TEXT.finishedBody)
        this.stepCard.setStatus("")
      } else {
        this.stepCard.setStep(TEXT.stepHeader(this._stepIndex + 1, STEPS.length), STEPS[this._stepIndex])
        this.stepCard.setStatus(this._phase !== "none" ? this.recapString : "")
      }
      this.stepCard.setFattoEnabled(!this._finished && this._phase === "none")
    }

    if (this.ovenTimer) {
      this.ovenTimer.setVisible(this._phase !== "none")
      if (this._phase !== "none") {
        this.ovenTimer.setPhaseLabel(TEXT.phaseLabel(this._phase))
        this.ovenTimer.setTime(formatClock(this._remaining))
      }
    }

    if (this.timerReminder) {
      if (this.reminderVisibleNow) {
        this.timerReminder.show(this.reminderActive ? this._reminderText : this._notice)
      } else {
        this.timerReminder.hide()
      }
    }

    if (this.recap) {
      const show = this.recapVisibleNow
      if (show) this.recap.setText(this.recapString)
      this.recap.setVisible(show)
    }
  }

  // ── Read-only state for tests ─────────────────────────────────────────────
  get stepIndex(): number {
    return this._stepIndex
  }

  get stepCount(): number {
    return STEPS.length
  }

  get currentStepText(): string {
    return this._finished ? TEXT.finishedBody : STEPS[this._stepIndex]
  }

  get isFinished(): boolean {
    return this._finished
  }

  get timerPhase(): OvenPhase {
    return this._phase
  }

  get isTimerRunning(): boolean {
    return this._phase !== "none"
  }

  get remainingSeconds(): number {
    return Math.max(0, this._remaining)
  }

  get isReminderVisible(): boolean {
    return this.reminderVisibleNow
  }

  get isRecapVisible(): boolean {
    return this.recapVisibleNow
  }

  get isOvenInView(): boolean {
    return this._ovenInView
  }

  isDoseLabelVisible(id: string): boolean {
    return this.doseVisible(id)
  }

  getVisibleDoseLabels(): string[] {
    const out: string[] = []
    for (const c of this.containers) if (this.doseVisible(c.ingredientId)) out.push(c.ingredientId)
    return out
  }

  getContainer(id: string): BiscottiContainer | null {
    for (const c of this.containers) if (c.ingredientId === id) return c
    return null
  }

  getState(): BiscottiFlowState {
    const confirmedIds: string[] = []
    for (const k in this.confirmed) if (this.confirmed[k]) confirmedIds.push(k)
    return {
      stepIndex: this._stepIndex,
      stepNumber: this._stepIndex + 1,
      stepCount: STEPS.length,
      stepText: this.currentStepText,
      finished: this._finished,
      fattoEnabled: !this._finished && this._phase === "none",
      timerPhase: this._phase,
      timerRunning: this._phase !== "none",
      remainingSeconds: this.remainingSeconds,
      ovenTimerVisible: this._phase !== "none",
      ovenTimerText: this._phase !== "none" ? formatClock(this._remaining) : "",
      reminderVisible: this.reminderVisibleNow,
      reminderText: this.reminderActive ? this._reminderText : this._notice,
      noticeText: this._notice,
      ovenInView: this._ovenInView,
      recapVisible: this.recapVisibleNow,
      recapText: this.recapVisibleNow ? this.recapString : "",
      confirmedIngredients: confirmedIds,
      visibleDoseLabels: this.getVisibleDoseLabels(),
      timeScale: this.timeScale
    }
  }
}
