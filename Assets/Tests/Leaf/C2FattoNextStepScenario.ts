/**
 * Done criterion 2: "Pressing 'Fatto' shows the next step next to the ingredients."
 *
 * Presses "Fatto" from step 1 up to step 7 (the oven step) and checks after every
 * press that the step card's StepText shows the next step of the brief verbatim and
 * the header reads "Passo N di 9". Then checks where the card is: on the table's
 * footprint, at its back edge, just above the tabletop, and close to the containers.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {
  BiscottiInput,
  cleanupLens,
  EXPECTED_INGREDIENTS,
  EXPECTED_STEPS,
  fmt,
  log,
  meshBounds,
  OVEN_STEP_INDEX,
  prepareLens,
  requireObject,
  textOf,
  waitFrames,
  waitUntil,
  worldPos
} from "./BiscottiLeafSupport"

@component
export class C2FattoNextStepScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ctrl = await prepareLens()
    const input = new BiscottiInput(config)
    try {
      expect(ctrl.stepIndex, "start at step 1").toBe(0)
      expect(textOf("StepText"), "step card shows step 1").toBe(EXPECTED_STEPS[0])
      expect(requireObject("StepCard").isEnabledInHierarchy, "step card visible").toBe(true)

      // Steps 1 → 7: each press shows the next step (step 7 itself starts the oven: criterion 3).
      while (ctrl.stepIndex < OVEN_STEP_INDEX) {
        const before = ctrl.stepIndex
        const beforeText = textOf("StepText")
        await input.pressFatto()
        await waitUntil(() => ctrl.stepIndex === before + 1, 3000, `step ${before + 2} after pressing Fatto`)
        await waitFrames(2)

        const n = before + 2
        const shown = textOf("StepText")
        expect(shown, `StepText after Fatto on step ${before + 1}`).toBe(EXPECTED_STEPS[before + 1])
        expect(shown === beforeText, "step text changed").toBe(false)
        expect(textOf("HeaderText"), "step header").toBe(`Passo ${n} di 9`)
        expect(ctrl.currentStepText, "controller currentStepText").toBe(EXPECTED_STEPS[before + 1])
        log(`C2 Fatto on step ${before + 1} -> StepText="${shown}" header="${textOf("HeaderText")}"`)
      }

      // Where the card sits: next to the ingredients, at the back edge of the table.
      const card = worldPos("StepCard")
      const table = meshBounds("Table")
      const tableTop = table.max.y
      const backEdgeZ = table.min.z // the user faces -Z, so the far (back) edge has the smallest z
      let nearest = 1e9
      let nearestName = ""
      for (const ing of EXPECTED_INGREDIENTS) {
        const d = card.distance(worldPos(ing.container))
        if (d < nearest) {
          nearest = d
          nearestName = ing.container
        }
      }
      log(
        `C2 StepCard at ${fmt(card)}; table x[${table.min.x.toFixed(1)}, ${table.max.x.toFixed(1)}] ` +
          `top y=${tableTop.toFixed(1)} back edge z=${backEdgeZ.toFixed(1)}; nearest container ${nearestName} ${nearest.toFixed(1)} cm`
      )
      expect(card.x >= table.min.x && card.x <= table.max.x, "card over the table's width").toBe(true)
      expect(Math.abs(card.z - backEdgeZ), "card distance from the table's back edge (cm)").toBeLessThan(15)
      expect(card.y - tableTop, "card height above the tabletop (cm)").toBeGreaterThan(0)
      expect(card.y - tableTop, "card height above the tabletop (cm)").toBeLessThan(40)
      expect(nearest, "card distance to the nearest ingredient container (cm)").toBeLessThan(45)

      log(`C2 done via ${input.describe()}`)
    } finally {
      cleanupLens()
    }
  }
}
