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

## Anti-Goals

- Generic dashboard spacing with no local hierarchy.
- Oversized utility buttons.
- Floating explanatory text not attached to a control.
- Repeated explanations in adjacent places.
- Layouts that read as stitched together from unrelated blocks.
- Beginner screens that ask users to parse every system concept at once.

