---
name: wayfarer-ui-layout-refinement
description: Use when refining Wayfarer UI that works but feels assembled, cluttered, duplicated, or poorly composed, especially in desktop analyst-console layouts.
---

# Wayfarer UI Layout Refinement

## Purpose

Refine an existing Wayfarer UI without redesigning it from scratch. Preserve the information architecture, clarify each region’s job, remove duplication, strengthen hierarchy, and make the screen feel intentional.

## When to Use

Use this skill when:

- a Wayfarer screen already works but feels haphazard, crowded, or stitched together;
- setup, workflow, status, inspection, and utility actions are visually mixed together;
- novice and expert modes need different presentation, not different truth;
- presets, explanations, and controls are repeating the same information;
- a layout needs polish around spacing, alignment, grouping, or emphasis.

Do not use this skill for:

- full product redesigns;
- unrelated styling experiments;
- mobile-first redesigns unless mobile is explicitly the target;
- changes to simulation/model behavior.

## Quick Scan

Before editing, identify the job of each visible region:

1. Context
2. Setup / Input
3. Primary Workflow
4. Status / Results
5. Inspection / Detail
6. Utility / Administration

If a region has no clear job, it is probably noise, duplication, or decoration.

## Core Rules

### Module Chrome And Collapse Grammar

Treat each visible module as the primary unit of comprehension.

- one visible hierarchy per module:
  - optional eyebrow;
  - exactly one title;
  - optional subtitle;
  - optional actions;
  - optional collapse toggle.
- do not stack duplicate titles/eyebrows that restate the same module.
- collapse controls must be owned by one component only (no duplicate toggles for the same surface).
- collapse controls must be on the same row as the title, not on a row below it.

Structural grouping keys (for ordering/state) may exist in code without visible chrome.

- if a group header is only scaffolding, suppress visible wrapper chrome and let child modules stand on their own;
- preserve ordering semantics even when group chrome is hidden.

### Tray Inward-Edge Toggle Rule

For side trays and tray sub-sections, place collapse controls on the inward edge to minimize wasted width.

- left-edge tray/surfaces: toggle on the right side of the title row;
- right-edge tray/surfaces: toggle on the left side of the title row;
- apply this at tray header level and nested section level;
- keep title and toggle on the same row.

### Sticky Header Aware Jump Navigation

When adding jump-to-module navigation:

- option labels should match visible module names;
- include only modules visible in the current mode/state;
- every option must map to a real DOM anchor id;
- scroll behavior must account for sticky header height so targets land below sticky surfaces, not behind them.

### Card And Affordance Taxonomy

Use visible card copy first. A well-formed summary card should usually explain itself through:

- `label`: what the value is;
- `value`: the current state or magnitude;
- `helper`: how to read the value and common boundaries/misreadings.

Use typed affordances only when they do a distinct job that visible helper text cannot do compactly:

- `?` contextual interpretation (`what does this mean here?`);
- `ƒ` formula/audit trail (`how is this calculated?`);
- `?ƒ` both interpretation and formula are worth separate inspection.

Decision rule:

- no icon when visible helper text already explains the card clearly;
- `?` when contextual interpretation is needed;
- `ƒ` when calculation/audit transparency matters;
- `?ƒ` only when both are genuinely useful and non-redundant.

Cards vs compact controls:

- summary cards usually have enough space for label/value/helper and should prefer visible explanation;
- compact controls (icon buttons, tiny toggles) often need tooltips/popovers because they lack room for helper text.

Avoid overuse:

- a tooltip is not free;
- every added affordance increases scan cost and interaction overhead;
- do not apply `?`/`ƒ`/`?ƒ` mechanically across all cards.

### Start With Jobs

Ask what each region does before changing spacing or styling.

- Does it set context?
- Does it configure the starting condition?
- Does it drive the main workflow?
- Does it show results or state?
- Does it support inspection or debugging?
- Does it provide utilities?

If controls, status, explanation, and utility are mixed together, fix the responsibilities first.

### Keep the Main Loop Obvious

Primary workflow should remain the visual anchor.

- Setup belongs above the main workflow when setup is the current task.
- Secondary and utility actions should not compete with the main action.
- Destructive or reset-like controls should be visible but quieter than the primary action.

### Make Copy Do Different Jobs

Each text element should have a distinct job:

- label: names a control or value;
- subtitle: explains the purpose of a section;
- helper: clarifies a nearby control;
- rationale: explains why a preset or mode exists;
- status: reports what is currently true;
- instruction: tells the user what to do next;
- diagnostic: explains what may be wrong.

Do not use multiple text elements to do the same job in one visual area.

### Prefer Vertical Grouping

Use side-by-side blocks only when they are intentionally paired.

- Keep labels close to the controls they describe.
- Use nested frames for subordinate utilities.
- Put secondary/admin actions in a quieter row or footer.
- Avoid adjacent boxes touching without breathing room.

### Preserve Novice Truth, Not Novice Noise

Novice mode should simplify presentation, not hide the system.

- Keep instructional rails open when they teach.
- Prefer presets before raw controls.
- Keep dynamic preset explanations fully visible in their own framed block.
- Show one next action clearly.
- Collapse or subordinate deep diagnostics until needed.

Expert mode should expose resolved controls and allow direct editing without turning into a junk drawer.

## Wayfarer-Specific Layout Priorities

When refining this project, prefer:

1. `Simulation setup` above `Primary workflow`.
2. A compact preset control plus a separate framed preset-details block.
3. Dynamic preset text kept visible, not collapsed into help text.
4. A small `Simulation JSON` utility subsection.
5. Export/import as subordinate utilities.
6. Regenerate/reset/debug grouped as quieter administrative actions.
7. Novice instructional rails open by default when they teach.
8. Side panels aligned intentionally rather than feeling accidental.
9. Dashboard section group keys can remain structural (`overview`, `routing`, `recovery`, `debug`) while visible chrome is module-first.
10. `Primary workflow` collapsed state should keep high-value at-a-glance controls/status and hide instructional prose.

## Decision Test

Before keeping a label, note, sentence, badge, button, panel, or box, ask:

- What job does this element perform?
- Does it clarify a nearby control or result?
- Does it add new information?
- Does it improve scanability?
- Does it duplicate a visible control?
- Is it visible at the right moment for the current mode?
- Does it belong to context, setup, workflow, status, inspection, or utility?

If the answer is no, move it, collapse it, shorten it, or remove it.

## Common Fixes

- Move mode explanations next to the mode toggle, not inside setup.
- Turn repeated prose into a help tip or remove it.
- Put dynamic preset explanations in their own framed block.
- Narrow utility boxes so they feel subordinate.
- Balance footer actions across the available horizontal space.
- Reduce tangents and accidental box-to-box collisions.
- Remove visible scaffold headers that do not explain workflow decisions.
- Convert repeated section/group wrappers into chrome-less structural containers.
- Add per-module collapse where modules are visually discrete and independently scannable.
- Place jump controls with at-a-glance status surfaces if they are useful in collapsed workflow state.

## Pattern Table (Before / After)

Use this table as a fast decision rubric during refinement passes.

| Concern | Bad Pattern | Preferred Pattern |
|---|---|---|
| Module hierarchy | Panel title + repeated inner heading + repeated subtitle | One visible hierarchy stack owned by module header |
| Group wrappers | Visible `Inspection / dashboard panels` scaffolding with no workflow meaning | Structural grouping in code, chrome-less rendering in UI |
| Collapse placement | Toggle below title row or floating away from actions | Toggle on same row as title, grouped with local actions |
| Collapse ownership | Two toggles controlling one visual module | Single owner of collapse behavior per module |
| Tray alignment | Left/right trays both place toggles on same side regardless of edge | Inward-edge rule: left tray toggle right, right tray toggle left |
| Tray subsection headers | Collapsible subsection title on one line, arrow on next line | Title and toggle on same row in tray subsections |
| Narrative tray density | Header badges/chips that restate obvious context | Keep header minimal; prioritize narrative title and section entry points |
| Jump navigation labels | Internal key names or stale labels | Labels match visible module names exactly |
| Jump navigation options | Options for hidden modules in current mode | Visibility-aware options (novice/expert/debug state) |
| Jump target behavior | `scrollIntoView` hides target behind sticky header | Sticky-aware offset scrolling below primary sticky surface |
| Anchor integrity | Jump options with missing DOM ids | Every option maps to a real, unique anchor id |
| Collapsed sticky workflow | Collapsed state hides both prose and key status controls | Collapsed state keeps at-a-glance status + high-value controls |

## Anti-Goals

- Generic dashboard spacing with no local hierarchy.
- Oversized utility buttons.
- Floating explanatory text not attached to a control.
- Repeated explanations in adjacent places.
- Layouts that read as stitched together from unrelated blocks.
- Beginner screens that ask users to parse every system concept at once.
