/**
 * LeafIndex — registers the "Biscotti al burro" LEAF scenarios, one per done
 * criterion in devpost/design-brief.md. Attach to a root SceneObject named "LeafIndex".
 *
 * Parameters (override per run): input = hand | sik | api, hand = left | right.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DEFAULT_PARAMS} from "./BiscottiLeafSupport"
import {C1DoseLabelsScenario} from "./C1DoseLabelsScenario"
import {C2FattoNextStepScenario} from "./C2FattoNextStepScenario"
import {C3OvenTimerRemindersScenario} from "./C3OvenTimerRemindersScenario"
import {C4RecapOutOfViewScenario} from "./C4RecapOutOfViewScenario"
import {DemoTourScenario} from "./DemoTourScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-dose-labels", typename: C1DoseLabelsScenario.getTypeName(), parameters: {...DEFAULT_PARAMS}},
    {id: "c2-fatto-next-step", typename: C2FattoNextStepScenario.getTypeName(), parameters: {...DEFAULT_PARAMS}},
    {id: "c3-oven-timer-reminders", typename: C3OvenTimerRemindersScenario.getTypeName(), parameters: {...DEFAULT_PARAMS}},
    {id: "c4-recap-out-of-view", typename: C4RecapOutOfViewScenario.getTypeName(), parameters: {...DEFAULT_PARAMS}},
    // Not a test: the paced walkthrough used to record the demo video.
    {id: "demo-tour", typename: DemoTourScenario.getTypeName(), parameters: {...DEFAULT_PARAMS}}
  ]
}
