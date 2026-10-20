---
status: approved
---

# Design brief: Biscotti al burro (default name)

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
I'm at my kitchen table making butter cookies, pouring the melted butter into the flour "volcano" with one hand and mixing with the other. Next to each container I see its dose ("300 g di farina"), the current step sits right next to the ingredients, and while the cookies bake the timer on the oven reminds me before time is up, even when I've walked away.

## Why it belongs on glasses
- Uses: draws in the world (doses next to each container, timer on the oven); leaves your body free (hands in butter and flour, eyes stay on the bowl); shares your view in the real version (it would tell the containers apart by color and size).
- Why it's better than the phone or laptop version: today I keep going back to look at the recipe. With hands covered in butter and flour I can't scroll a phone, and here the information sits on the thing it's about.

## Product or overlay
- Type: overlay: it responds to the real containers and oven in my kitchen.
- What the real version would sense: the table (square, rectangular or round) and the round containers on it (bowls, pans, plates, glasses), telling them apart by color and size; my voice when I read an ingredient aloud.
- Stand-in for the preview: a virtual kitchen at real scale (table, containers, oven). Each virtual container has its own color and size, and the Lens already knows (hard-coded) which ingredient belongs to which container. A pinch on a container confirms it and shows its dose label.

## Where things live
- Where the user is looking during the main task: down at the table, at the containers and the mixing bowl.
- Table: virtual kitchen table, rectangular (default), 120 x 80 cm, 75 cm high (default), its front edge about 50 cm in front of the user at start (default).
- Containers: round, each a different color and size, in light, bright colors so they show on the additive display (default colors and sizes):
  - flour: large bowl
  - sugar: medium bowl
  - butter (melted): small saucepan
  - whole egg: small cup
  - yolk: small cup
  - baking powder: small dish with the sachet
  - an empty mixing bowl where the "volcano" is made (default; the recipe allows a bowl)
- Dose labels: next to each container, about 10 cm above its rim (default), facing the user, text about 2 cm tall (default), e.g. "300 g di farina".
- Step card: next to the ingredients, at the back edge of the table, tilted toward the user, about 30 x 15 cm (default).
- "Fatto" button: big, about 8 cm across (default), right beside the step card.
- Oven: virtual gas oven with no numbers on the dial, beside the table about 1.2 m to the user's right (default), so it's out of view while working at the table.
- Oven timer: on the oven door, about 20 x 10 cm (default), shows the phase (sotto / sopra) and the countdown.
- Recap: a small strip low in view (default: low rather than high), about 1 m away, following gently rather than stuck to the face (default). Shows what's cooking and the time left, e.g. "In forno: sotto, 3:20".

## Recipe content
UI text in Italian, from the learner's recipe.
- Ingredients and dose labels: 300 g di farina · 120 g di zucchero · 125 g di burro (fuso) · 1 uovo intero · 1 tuorlo, senza albume · 1 bustina di lievito per dolci
- Steps:
  1. Fai un vulcano con la farina e lo zucchero.
  2. Al centro metti l'uovo, il tuorlo e il lievito.
  3. Versa lentamente il burro nel vulcano e, con l'altra mano, mescola.
  4. Poco alla volta, aggiungi la farina fino a rendere l'impasto consistente.
  5. Forma una palla e mettila in frigorifero. (No timer: the recipe gives no time (default).)
  6. Quando è fredda, metti un po' di farina sotto e dai all'impasto la forma che preferisci.
  7. Inforna: cuoci sotto per 5 minuti. (Starts the oven timer.)
  8. Cuoci sopra per 5 minuti. (Starts the second oven timer.)
  9. Controlla: devono essere appena dorati.

## Hands and input
- Associate an ingredient with its container: pinch on the container.
- Go to the next step: pinch the big "Fatto" button.
- Start the oven timer: press "Fatto" on step 7 (default). Start the top phase: press "Fatto" when the bottom phase ends (default).
- Targets are big and highlight when aimed at.
- Voice (optional extra, may not work in the preview): say the ingredient aloud while reading the recipe. The pinch on the container does the same job. Build it only after the basic flow works (default).

## When things show
- Dose label: shows when you pinch its container; stays until the step that uses that ingredient is done (default).
- Step card: always shows the current step; changes to the next one when you press "Fatto".
- Oven timer: shows on the oven while a cooking phase runs.
- Timer reminder: shows 60 s and again 30 s before the end of each phase, hides after about 10 s. At the end of a phase: a chime (default) and the next instruction ("Ora cuoci sopra", then "Controlla: devono essere appena dorati").
- Recap: shows while a timer is running and the oven is out of view; hides when the oven is back in view (default).
- If something needs attention out of view: the recap, plus a chime (default).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Pinching the flour container shows the label "300 g di farina" next to it. Every other container shows its own dose the same way (default).
2. Pressing "Fatto" shows the next step next to the ingredients.
3. Pressing "Fatto" on the oven step starts a timer on the oven; a reminder appears 60 s and again 30 s before the end and disappears after about 10 s.
4. Walking away so the oven is out of view while the timer runs, a small recap appears low in view with what's cooking and the time left.

## Out of scope
- Shopping for the ingredients (part of the first idea; this version is about preparation).
- Checking the real quantity in a container: the Lens shows the dose and you check it (default).
- Recognizing the real table, containers or oven (faked as described above).
- OK, victory and thumbs-up gestures (replaced by the "Fatto" button).
- Other recipes (pasta, cakes): this version is butter cookies only.

## Risks and open questions
- Voice may not work in the preview; the pinch on the container does the same job.
- The timers are real (5 + 5 minutes); the learner will cut the video to stay under 3 minutes. A test-only speed setting lets LEAF check the reminders without waiting (default).
- The fridge step has no time in the recipe, so it has no timer (default).
- The UI text is in Italian, as the learner wrote it; the video may need English captions for the judges (open question).
- Feel unproven: whether the labels and the recap stay readable with real hands in the dough, and whether a chime is noticed in a real kitchen.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
