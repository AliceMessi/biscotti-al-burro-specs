/**
 * Done criterion 1: "Pinching the flour container shows the label '300 g di farina'
 * next to it. Every other container shows its own dose the same way."
 *
 * For each of the six containers: pinch it, then check that its own DoseLabel_<X>
 * turned on (scene .enabled), shows the exact dose text from the brief, sits next to
 * that container (above its rim, centred on it), and that no other label turned on.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {
  BiscottiInput,
  cleanupLens,
  EXPECTED_INGREDIENTS,
  fmt,
  log,
  meshBounds,
  prepareLens,
  requireObject,
  textOf,
  waitFrames,
  waitUntil,
  worldPos
} from "./BiscottiLeafSupport"

@component
export class C1DoseLabelsScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ctrl = await prepareLens()
    const input = new BiscottiInput(config)
    try {
      const visibleCount = () => EXPECTED_INGREDIENTS.filter((i) => requireObject(i.label).enabled).length

      // Clean start: no dose label shows before any pinch.
      expect(visibleCount(), "dose labels visible right after restart").toBe(0)

      for (const ing of EXPECTED_INGREDIENTS) {
        const label = requireObject(ing.label)
        const before = visibleCount()
        expect(label.enabled, `${ing.label} hidden before pinching ${ing.container}`).toBe(false)

        await input.pinchContainer(ing)
        await waitUntil(() => label.enabled, 3000, `${ing.label} to show after pinching ${ing.container}`)
        await waitFrames(2)

        // Its own exact dose text.
        const shown = textOf(ing.label)
        expect(shown, `${ing.label} text`).toBe(ing.dose)
        expect(ctrl.isDoseLabelVisible(ing.id), `controller says ${ing.id} label visible`).toBe(true)
        // Only this label turned on.
        expect(visibleCount(), `visible labels after pinching ${ing.container}`).toBe(before + 1)

        // Next to its own container: above the rim, centred over it.
        const c = worldPos(ing.container)
        const p = label.getTransform().getWorldPosition()
        const rimY = meshBounds(ing.container).max.y
        const horiz = Math.sqrt((p.x - c.x) * (p.x - c.x) + (p.z - c.z) * (p.z - c.z))
        const aboveRim = p.y - rimY
        expect(label.getParent().name, `${ing.label} parent`).toBe(ing.container)
        expect(horiz, `${ing.label} horizontal offset from ${ing.container} (cm)`).toBeLessThan(5)
        expect(aboveRim, `${ing.label} height above the rim (cm)`).toBeGreaterThan(3)
        expect(aboveRim, `${ing.label} height above the rim (cm)`).toBeLessThan(25)

        log(
          `C1 ${ing.id}: pinched ${ing.container} -> ${ing.label}.enabled=true text="${shown}" ` +
            `at ${fmt(p)}, ${horiz.toFixed(1)} cm from container axis, ${aboveRim.toFixed(1)} cm above rim; visible=${visibleCount()}`
        )
      }

      const state = ctrl.getState()
      expect(state.visibleDoseLabels.length, "all six dose labels visible at the end").toBe(6)
      log(`C1 done via ${input.describe()}; visibleDoseLabels=${state.visibleDoseLabels.join(",")}`)
    } finally {
      cleanupLens()
    }
  }
}
