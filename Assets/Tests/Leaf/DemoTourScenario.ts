/**
 * Demo tour (not a done-criterion test): plays the whole recipe at a readable pace for
 * the demo video, with the same simulated hand and head as the LEAF tests.
 *
 *   table overview -> pinch flour + sugar -> Fatto -> egg, yolk, baking powder -> Fatto
 *   -> butter -> Fatto x3 -> step 7: Fatto starts the oven timer -> look at the oven
 *   -> back to the table (recap) -> time-lapse to the 60 s reminder -> end of "sotto"
 *   -> Fatto starts "sopra" -> time-lapse to the end -> Fatto -> finished.
 *
 * Time-lapses use the test-only setTimeScale(); everything else runs in real time.
 * Each beat prints "[BiscottiLeaf] MARK <name>" so the recording can be cut on it.
 * Hides LEAF's on-screen status strip so it doesn't cover the view.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {findSceneObjectByName, nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {
  BiscottiInput,
  cleanupLens,
  EXPECTED_INGREDIENTS,
  HeadPose,
  log,
  prepareLens,
  waitUntil,
  worldPos
} from "./BiscottiLeafSupport"

const ING = (id: string) => EXPECTED_INGREDIENTS.find((i) => i.id === id)!

function mark(name: string): void {
  log("MARK " + name)
}

function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Smooth head moves on top of HeadPose (which holds the camera every frame). */
class Gaze {
  private eye: vec3
  private target: vec3

  constructor(
    private head: HeadPose,
    eye: vec3,
    target: vec3
  ) {
    this.eye = eye
    this.target = target
    head.look(eye, target)
  }

  async to(eye: vec3, target: vec3, seconds: number): Promise<void> {
    const fromEye = this.eye
    const fromTarget = this.target
    const start = getTime()
    let t = 0
    while (t < 1) {
      t = Math.min(1, (getTime() - start) / seconds)
      const e = ease(t)
      this.head.look(vec3.lerp(fromEye, eye, e), vec3.lerp(fromTarget, target, e))
      await nextFrame()
    }
    this.eye = eye
    this.target = target
  }
}

function hideLeafOverlay(): void {
  const strip = findSceneObjectByName("LeafDebugUICamera")
  if (strip) strip.enabled = false
}

@component
export class DemoTourScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    hideLeafOverlay()
    const ctrl = await prepareLens()
    hideLeafOverlay()
    const input = new BiscottiInput(config)
    const head = new HeadPose()
    try {
      const atTable = new vec3(0, 0, 0)
      const overview = new vec3(0, -58, -100)
      const leftSide = new vec3(-26, -64, -84)
      const rightSide = new vec3(14, -66, -96)
      const card = worldPos("StepCard").add(new vec3(4, -6, 0))
      const ovenTimer = worldPos("OvenTimer")
      // Far enough back to frame the timer on the door and the reminder bubble above the oven.
      const nearOven = new vec3(5, 0, 25)
      const ovenView = new vec3(ovenTimer.x + 4, -65, ovenTimer.z)

      const gaze = new Gaze(head, atTable, overview)
      await sleep(1500)
      mark("start")
      await sleep(2500)

      // Doses next to the containers.
      await gaze.to(atTable, leftSide, 1.6)
      mark("pinch_flour")
      await input.pinchContainer(ING("flour"))
      await sleep(2200)
      mark("pinch_sugar")
      await input.pinchContainer(ING("sugar"))
      await input.rest()
      await sleep(2000)

      // Step card + "Fatto".
      await gaze.to(atTable, overview, 1.4)
      await sleep(1200)
      mark("fatto_1")
      await input.pressFatto()
      await input.rest()
      await sleep(2300)

      await gaze.to(atTable, rightSide, 1.4)
      mark("pinch_egg")
      await input.pinchContainer(ING("egg"))
      await sleep(1100)
      await input.pinchContainer(ING("yolk"))
      await sleep(1100)
      await input.pinchContainer(ING("bakingPowder"))
      await input.rest()
      await sleep(1900)

      await gaze.to(atTable, overview, 1.2)
      mark("fatto_2")
      await input.pressFatto()
      await input.rest()
      await sleep(1100)
      mark("pinch_butter")
      await input.pinchContainer(ING("butter"))
      await input.rest()
      await sleep(2100)

      // Steps 4 to 7.
      await gaze.to(atTable, card.add(new vec3(0, -12, 20)), 1.2)
      mark("steps_4_to_7")
      for (let i = 0; i < 4; i++) {
        await input.pressFatto()
        await input.rest()
        await sleep(i < 3 ? 1300 : 2200)
      }

      // Step 7: the oven timer starts on the oven.
      mark("fatto_oven")
      await input.pressFatto()
      await waitUntil(() => ctrl.timerPhase === "sotto", 3000, "'sotto' timer to start")
      await input.rest()
      await sleep(400)
      await gaze.to(nearOven, ovenView, 2.4)
      mark("oven_timer")
      await sleep(4000)

      // Back to the table: the oven leaves the view and the recap shows.
      await gaze.to(atTable, overview, 2.2)
      await waitUntil(() => ctrl.isRecapVisible, 3000, "recap with the oven out of view")
      mark("recap")
      await sleep(4500)

      // Time-lapse to the 60 s reminder.
      mark("timelapse_1")
      // Stop well before 60 s: at x30 one slow preview frame can skip several timer
      // seconds, and the reminder must start (and run its 10 s) in real time.
      ctrl.setTimeScale(30)
      await waitUntil(() => ctrl.remainingSeconds <= 67, 20000, "67 s left")
      ctrl.setTimeScale(1)
      await waitUntil(() => ctrl.isReminderVisible, 15000, "60 s reminder")
      mark("reminder_60")
      await sleep(1500)
      await gaze.to(nearOven, ovenView, 1.8)
      mark("reminder_at_oven")
      await sleep(4000)

      // Time-lapse to the end of "sotto".
      mark("timelapse_2")
      ctrl.setTimeScale(30)
      await waitUntil(() => ctrl.timerPhase === "none", 20000, "end of 'sotto'")
      ctrl.setTimeScale(1)
      mark("end_sotto")
      await sleep(3500)

      // "Ora cuoci sopra": Fatto starts the top phase.
      await gaze.to(atTable, card.add(new vec3(0, -12, 20)), 2.0)
      await sleep(1500)
      mark("fatto_sopra")
      await input.pressFatto()
      await waitUntil(() => ctrl.timerPhase === "sopra", 3000, "'sopra' timer to start")
      await input.rest()
      await sleep(2000)

      mark("timelapse_3")
      ctrl.setTimeScale(40)
      await waitUntil(() => ctrl.timerPhase === "none", 20000, "end of 'sopra'")
      ctrl.setTimeScale(1)
      mark("end_sopra")
      await sleep(3500)

      mark("fatto_finish")
      await input.pressFatto()
      await input.rest()
      await sleep(3500)
      mark("end")
    } finally {
      head.release()
      cleanupLens()
    }
  }
}
