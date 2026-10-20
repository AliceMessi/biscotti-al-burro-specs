/**
 * Done criterion 4: "Walking away so the oven is out of view while the timer runs, a
 * small recap appears low in view with what's cooking and the time left."
 *
 * Starts the "sotto" timer (real time), then moves the user's head (the world camera,
 * held at a test pose the way LEAF's IK head does):
 *   1. looking at the oven        -> oven in view, no recap
 *   2. walked away, oven behind   -> recap shows "In forno: sotto, m:ss", ~1 m away,
 *                                    below the centre of view, inside the view
 *   3. 2 s later                  -> time left counts down on the recap
 *   4. looking at the oven again  -> recap hides
 * Also guards: no recap while no timer runs, even with the oven out of view.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  advanceToStep,
  BiscottiInput,
  cleanupLens,
  fmt,
  HeadPose,
  log,
  OVEN_STEP_INDEX,
  parseClock,
  prepareLens,
  requireObject,
  textOf,
  waitFrames,
  waitUntil,
  worldPos
} from "./BiscottiLeafSupport"

const RECAP_PATTERN = /^In forno: sotto, \d+:\d\d$/

@component
export class C4RecapOutOfViewScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ctrl = await prepareLens()
    const input = new BiscottiInput(config)
    const head = new HeadPose()
    try {
      const recap = requireObject("Recap")
      const ovenTimerPos = worldPos("OvenTimer")
      const atTable = new vec3(0, 0, 0) // where the user stands at start
      const tableCentre = worldPos("Table").add(new vec3(0, 75, 0)) // tabletop centre
      const walkedAway = new vec3(-120, 0, 60) // ~1.3 m to the left and back, facing away from the oven
      const awayLook = walkedAway.add(new vec3(-50, -40, -100))

      await advanceToStep(input, OVEN_STEP_INDEX)

      // Guard: oven out of view but no timer yet -> no recap.
      head.look(atTable, tableCentre)
      await waitFrames(5)
      expect(ctrl.isOvenInView, "oven out of view while looking at the table").toBe(false)
      expect(recap.enabled, "no recap before the timer starts").toBe(false)

      // Start the timer in real time.
      ctrl.setTimeScale(1)
      await input.pressFatto()
      await waitUntil(() => ctrl.timerPhase === "sotto", 3000, "'sotto' timer to start after Fatto")

      // 1. Looking at the oven: in view, no recap.
      head.look(atTable, ovenTimerPos)
      await waitFrames(3)
      log(`C4 head turned to the oven: ${head.describe(ovenTimerPos, 10)}; controller isOvenInView=${ctrl.isOvenInView}`)
      await waitUntil(() => ctrl.isOvenInView, 2000, "oven to count as in view when looking at it")
      await waitFrames(3)
      expect(requireObject("OvenTimer").enabled, "oven timer running").toBe(true)
      expect(recap.enabled, "no recap while the oven is in view").toBe(false)
      log(`C4 looking at the oven: isOvenInView=${ctrl.isOvenInView} Recap.enabled=${recap.enabled}`)

      // 2. Walk away so the oven is out of view.
      head.look(walkedAway, awayLook)
      await waitUntil(() => !ctrl.isOvenInView, 2000, "oven to leave the view after walking away")
      await waitUntil(() => recap.enabled, 2000, "recap to appear with the oven out of view")
      await waitFrames(5)
      const text1 = textOf("RecapText")
      const secs1 = parseClock(text1)
      const m = head.metrics(recap.getTransform().getWorldPosition())
      log(
        `C4 walked away to ${fmt(walkedAway)}: isOvenInView=${ctrl.isOvenInView} Recap.enabled=${recap.enabled} ` +
          `text="${text1}" remaining=${ctrl.remainingSeconds.toFixed(1)} s; recap ${m.dist.toFixed(1)} cm away, ` +
          `${m.belowDeg.toFixed(1)} deg below and ${m.rightDeg.toFixed(1)} deg right of view centre, inView=${m.inView}`
      )
      expect(RECAP_PATTERN.test(text1), `recap text format "In forno: sotto, m:ss" (was "${text1}")`).toBe(true)
      expect(Math.abs(secs1 - ctrl.remainingSeconds) <= 1.5, `recap time matches the timer (${text1} vs ${ctrl.remainingSeconds.toFixed(1)} s)`).toBe(true)
      expect(ctrl.getState().recapText, "controller recapText").toBe(text1)
      expect(m.inView, "recap inside the view").toBe(true)
      expect(m.belowDeg, "recap below the centre of view (deg)").toBeGreaterThan(5)
      expect(m.belowDeg, "recap not too low (deg)").toBeLessThan(30)
      expect(Math.abs(m.rightDeg), "recap horizontally centred (deg)").toBeLessThan(10)
      expect(m.dist, "recap distance (cm)").toBeGreaterThan(85)
      expect(m.dist, "recap distance (cm)").toBeLessThan(115)

      // 3. Time left keeps counting down on the recap.
      await sleep(2200)
      const text2 = textOf("RecapText")
      const secs2 = parseClock(text2)
      log(`C4 2.2 s later: text="${text2}"`)
      expect(recap.enabled, "recap still shown while away").toBe(true)
      expect(secs1 - secs2 >= 1 && secs1 - secs2 <= 4, `recap time counts down ("${text1}" -> "${text2}")`).toBe(true)

      // 4. Oven back in view: recap hides.
      head.look(atTable, ovenTimerPos)
      await waitUntil(() => ctrl.isOvenInView, 2000, "oven back in view")
      await waitUntil(() => !recap.enabled, 2000, "recap to hide with the oven back in view")
      log(`C4 oven back in view: isOvenInView=${ctrl.isOvenInView} Recap.enabled=${recap.enabled}`)

      log(`C4 done via ${input.describe()}`)
    } finally {
      head.release()
      cleanupLens()
    }
  }
}
