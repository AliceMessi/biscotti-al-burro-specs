/**
 * BiscottiRecipe — the single source of truth for the recipe content.
 *
 * Owns: every Italian string the user reads (doses, steps, timer notices),
 *       which ingredient belongs to which container id, and the last step
 *       that uses each ingredient (its dose label hides after that step).
 * Expects: nothing — plain data, no scene access.
 * Must not: hold runtime state or touch the scene. Edit text HERE only.
 *
 * Text is the learner's recipe from devpost/design-brief.md, verbatim.
 */

export type IngredientId = "flour" | "sugar" | "butter" | "egg" | "yolk" | "bakingPowder"

export interface Ingredient {
  id: IngredientId
  /** Dose label shown next to the container, verbatim from the brief. */
  dose: string
  /** 0-based index of the LAST step that uses this ingredient. */
  lastUseStep: number
}

export const INGREDIENTS: Ingredient[] = [
  {id: "flour", dose: "300 g di farina", lastUseStep: 3}, // used in step 1 and step 4
  {id: "sugar", dose: "120 g di zucchero", lastUseStep: 0},
  {id: "butter", dose: "125 g di burro (fuso)", lastUseStep: 2},
  {id: "egg", dose: "1 uovo intero", lastUseStep: 1},
  {id: "yolk", dose: "1 tuorlo, senza albume", lastUseStep: 1},
  {id: "bakingPowder", dose: "1 bustina di lievito per dolci", lastUseStep: 1}
]

export const STEPS: string[] = [
  "Fai un vulcano con la farina e lo zucchero.",
  "Al centro metti l'uovo, il tuorlo e il lievito.",
  "Versa lentamente il burro nel vulcano e, con l'altra mano, mescola.",
  "Poco alla volta, aggiungi la farina fino a rendere l'impasto consistente.",
  "Forma una palla e mettila in frigorifero.",
  "Quando è fredda, metti un po' di farina sotto e dai all'impasto la forma che preferisci.",
  "Inforna: cuoci sotto per 5 minuti.",
  "Cuoci sopra per 5 minuti.",
  "Controlla: devono essere appena dorati."
]

/** "Fatto" on this step starts the bottom ("sotto") oven phase. */
export const BOTTOM_PHASE_STEP = 6
/** Shown when the bottom phase ends; "Fatto" here starts the top ("sopra") phase. */
export const TOP_PHASE_STEP = 7
/** Shown when the top phase ends; the last step. */
export const CHECK_STEP = 8

export type OvenPhase = "none" | "sotto" | "sopra"

/** Every other string the Lens shows. */
export const TEXT = {
  stepHeader: (n: number, total: number) => `Passo ${n} di ${total}`,
  finishedHeader: "Fine",
  finishedBody: "Biscotti pronti. Buon appetito!",
  fatto: "Fatto",
  phaseLabel: (phase: OvenPhase) => (phase === "sopra" ? "Sopra" : "Sotto"),
  recapRunning: (phase: OvenPhase, time: string) => `In forno: ${phase}, ${time}`,
  noticeAfterBottom: "Ora cuoci sopra",
  noticeAfterTop: "Controlla: devono essere appena dorati",
  /** Reminder text for N seconds left (60 → "Manca 1 minuto", 30 → "Mancano 30 secondi"). */
  reminder: (secondsLeft: number) => {
    if (secondsLeft >= 60 && secondsLeft % 60 === 0) {
      const m = secondsLeft / 60
      return m === 1 ? "Manca 1 minuto" : `Mancano ${m} minuti`
    }
    return secondsLeft === 1 ? "Manca 1 secondo" : `Mancano ${secondsLeft} secondi`
  }
}

export function findIngredient(id: string): Ingredient | null {
  for (const ing of INGREDIENTS) {
    if (ing.id === id) return ing
  }
  return null
}

/** m:ss, rounding up so a fresh 5-minute phase reads 5:00. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r < 10 ? "0" : ""}${r}`
}
