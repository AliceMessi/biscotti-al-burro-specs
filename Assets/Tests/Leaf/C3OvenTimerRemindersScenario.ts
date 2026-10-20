/**
 * Done criterion 3: "Pressing 'Fatto' on the oven step starts a timer on the oven; a
 * reminder appears 60 s and again 30 s before the end and disappears after about 10 s."
 *
 * Both cooking phases are checked: step 7 "Fatto" starts "sotto"; when it ends the
 * card moves to step 8 and "Fatto" starts "sopra". Uses the Lens's test-only
 * setTimeScale: 30x until 70 s are left, then 10x so the 10 s reminder window is
 * sampled finely. All times below are TIMER seconds (what the user would experience).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {BiscottiFlowController} from "../../Scripts/BiscottiFlowController"
import {
  advanceToStep,
  BiscottiInput,
  cleanupLens,
  EXPECTED_STEPS,
  fmt,
  log,
  meshBounds,
  OVEN_STEP_INDEX,
  parseClock,
  prepareLens,
  requireObject,
  textOf,
  waitFrames,
  waitUntil,
  worldPos
} from "./BiscottiLeafSupport"

const FAST_SCALE = 30
const SLOW_SCALE = 10
const SLOW_BELOW_SEC = 70

interface ReminderEpisode {
  text: string
  shownAt: number
  hiddenAt: number
}

interface PhaseRecord {
  episodes: ReminderEpisode[]
  timerAlwaysOn: boolean
  clockMismatches: number
  noticeText: string
}

@component
export class C3OvenTimerRemindersScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ctrl = await prepareLens()
    const input = new BiscottiInput(config)
    try {
      await advanceToStep(input, OVEN_STEP_INDEX)
      expect(textOf("StepText"), "on the oven step").toBe(EXPECTED_STEPS[OVEN_STEP_INDEX])

      // The timer lives on the oven door.
      const timerObj = requireObject("OvenTimer")
      const oven = meshBounds("Oven")
      const tp = timerObj.getTransform().getWorldPosition()
      const pad = 5
      const onOven =
        tp.x >= oven.min.x - pad && tp.x <= oven.max.x + pad &&
        tp.y >= oven.min.y - pad && tp.y <= oven.max.y + pad &&
        tp.z >= oven.min.z - pad && tp.z <= oven.max.z + pad
      log(`C3 OvenTimer at ${fmt(tp)}; oven mesh ${fmt(oven.min)}..${fmt(oven.max)}`)
      expect(timerObj.getParent().name, "OvenTimer parent").toBe("Oven")
      expect(onOven, "OvenTimer sits on the oven (within 5 cm of its mesh bounds)").toBe(true)

      // ── Phase 1: "sotto" ────────────────────────────────────────────────────
      expect(timerObj.enabled, "no oven timer before Fatto on step 7").toBe(false)
      expect(ctrl.isTimerRunning, "timer not running before Fatto on step 7").toBe(false)
      await this.startPhase(ctrl, input, "sotto", "Sotto")
      const sotto = await this.runPhase(ctrl, "sotto")
      this.assertPhase("sotto", sotto)
      expect(ctrl.stepIndex, "after 'sotto' ends the card moves to step 8 by itself").toBe(7)
      expect(textOf("StepText"), "step 8 text").toBe(EXPECTED_STEPS[7])
      expect(sotto.noticeText, "end-of-phase notice after 'sotto'").toBe("Ora cuoci sopra")
      expect(timerObj.enabled, "oven timer hidden between phases").toBe(false)

      // ── Phase 2: "sopra" ────────────────────────────────────────────────────
      await this.startPhase(ctrl, input, "sopra", "Sopra")
      const sopra = await this.runPhase(ctrl, "sopra")
      this.assertPhase("sopra", sopra)
      expect(ctrl.stepIndex, "after 'sopra' ends the card moves to step 9").toBe(8)
      expect(sopra.noticeText, "end-of-phase notice after 'sopra'").toBe("Controlla: devono essere appena dorati")

      log(`C3 done via ${input.describe()}`)
    } finally {
      cleanupLens()
    }
  }

  /** Real-time press of "Fatto" on the oven step; checks the timer appears on the oven. */
  private async startPhase(
    ctrl: BiscottiFlowController,
    input: BiscottiInput,
    phase: string,
    label: string
  ): Promise<void> {
    ctrl.setTimeScale(1)
    await input.pressFatto()
    await waitUntil(() => ctrl.timerPhase === phase, 3000, `oven phase '${phase}' to start after Fatto`)
    await waitFrames(2)
    const clock = textOf("TimeText")
    const secs = parseClock(clock)
    expect(requireObject("OvenTimer").enabled, `OvenTimer shows during '${phase}'`).toBe(true)
    expect(textOf("PhaseText"), `OvenTimer phase label during '${phase}'`).toBe(label)
    expect(secs >= 295 && secs <= 300, `OvenTimer starts at about 5:00 (shows "${clock}")`).toBe(true)
    expect(ctrl.getState().fattoEnabled, "Fatto locked while the oven runs").toBe(false)
    log(`C3 Fatto on step ${ctrl.stepIndex + 1} -> phase '${phase}', OvenTimer.enabled=true "${textOf("PhaseText")} ${clock}"`)
  }

  /** Runs one phase to its end, recording every reminder episode in timer seconds. */
  private async runPhase(ctrl: BiscottiFlowController, phase: string): Promise<PhaseRecord> {
    const reminder = requireObject("TimerReminder")
    const timer = requireObject("OvenTimer")
    const rec: PhaseRecord = {episodes: [], timerAlwaysOn: true, clockMismatches: 0, noticeText: ""}
    let open: ReminderEpisode | null = null
    let wasVisible = reminder.enabled
    expect(wasVisible, `no reminder at the start of '${phase}'`).toBe(false)

    const deadline = getTime() + 40
    ctrl.setTimeScale(FAST_SCALE)
    while (ctrl.timerPhase === phase) {
      if (getTime() > deadline) throw new Error(`phase '${phase}' did not end within 40 s real time`)
      const rem = ctrl.remainingSeconds
      ctrl.setTimeScale(rem > SLOW_BELOW_SEC ? FAST_SCALE : SLOW_SCALE)

      const visible = reminder.enabled
      if (visible && !wasVisible) {
        open = {text: textOf("ReminderText"), shownAt: rem, hiddenAt: -1}
        rec.episodes.push(open)
        log(`C3 '${phase}' reminder shown at ${rem.toFixed(2)} s left: "${open.text}"`)
      } else if (!visible && wasVisible && open) {
        open.hiddenAt = rem
        log(`C3 '${phase}' reminder hidden at ${rem.toFixed(2)} s left (visible ${(open.shownAt - rem).toFixed(2)} s)`)
        open = null
      }
      wasVisible = visible

      if (!timer.enabled) rec.timerAlwaysOn = false
      const shownSecs = parseClock(textOf("TimeText"))
      if (Math.abs(shownSecs - rem) > 2) rec.clockMismatches++
      await nextFrame()
    }
    ctrl.setTimeScale(1)
    await waitFrames(2)
    // At the end of the phase the bubble switches to the next instruction.
    rec.noticeText = reminder.enabled ? textOf("ReminderText") : ""
    log(`C3 '${phase}' ended -> step ${ctrl.stepIndex + 1}, notice "${rec.noticeText}", OvenTimer.enabled=${timer.enabled}`)
    return rec
  }

  private assertPhase(phase: string, rec: PhaseRecord): void {
    expect(rec.timerAlwaysOn, `OvenTimer stayed visible for the whole '${phase}' phase`).toBe(true)
    expect(rec.clockMismatches, `OvenTimer clock matched the remaining time during '${phase}'`).toBe(0)
    expect(rec.episodes.length, `reminders shown during '${phase}'`).toBe(2)

    const [first, second] = rec.episodes
    expect(first.text, `'${phase}' first reminder text`).toBe("Manca 1 minuto")
    expect(first.shownAt <= 60.01 && first.shownAt >= 57.5, `'${phase}' first reminder at 60 s left (was ${first.shownAt.toFixed(2)})`).toBe(true)
    const firstFor = first.shownAt - first.hiddenAt
    expect(first.hiddenAt >= 0, `'${phase}' first reminder hid before the second one`).toBe(true)
    expect(firstFor > 8.5 && firstFor < 11.5, `'${phase}' first reminder visible about 10 s (was ${firstFor.toFixed(2)})`).toBe(true)

    expect(second.text, `'${phase}' second reminder text`).toBe("Mancano 30 secondi")
    expect(second.shownAt <= 30.01 && second.shownAt >= 27.5, `'${phase}' second reminder at 30 s left (was ${second.shownAt.toFixed(2)})`).toBe(true)
    const secondFor = second.shownAt - second.hiddenAt
    expect(second.hiddenAt >= 0, `'${phase}' second reminder hid before the end`).toBe(true)
    expect(secondFor > 8.5 && secondFor < 11.5, `'${phase}' second reminder visible about 10 s (was ${secondFor.toFixed(2)})`).toBe(true)
  }
}
