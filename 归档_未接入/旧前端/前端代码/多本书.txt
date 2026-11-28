---
name: add-complete-shelf-landing-page
description: "Build Complete Shelf from its verified authored source using Full HTML + DOM/CSS + Three.js r165, including the complete renderer, interactions, and required assets. Use when Codex needs to implement, port, or adapt this effect without requiring the ThreeUI package or reconstructing the visual from an approximation."
---

# Build Complete Shelf

## Description

The complete Working Volumes bookshelf page with all seven tools, its responsive editorial interface, and authored Three.js presentation.

Recreate the authored behavior from the verified source, not from screenshots or the abbreviated orchestration sample in this skill. The implementation may live directly in the target project and does not require `@designcodeio/threeui`.

## Technologies

- React iframe host
- Byte-exact complete authored HTML document
- Same-project local source URL
- Three.js r165 and all original embedded media

## Verified source material

- `src/shaders/landing-pages/LandingPages.tsx`
- `public/landing-pages/complete-shelf-v2.html — byte-exact complete page`

Source revision: `SHA-256 606f200fed86`

## Implementation steps

1. Open every verified source file listed above and identify the renderer, host lifecycle, styles, and assets before editing.
2. Copy the complete Complete Shelf HTML file byte-for-byte to /landing-pages/complete-shelf-v2.html; do not extract, rewrite, shorten, or rebrand any section.
3. Preserve every embedded style, script, media payload, text string, interaction, responsive rule, and document-level lifecycle.
4. Keep every relative local asset at the exact path expected by the original document.
5. Load the local document in a full-size iframe whose permissions retain the authored forms, modals, downloads, popups, scripts, and same-origin resources.
6. Lazy-load only the React host bundle; do not import the complete HTML into the application JavaScript graph.
7. Give the local component a sized, overflow-controlled parent and verify desktop, mobile, reduced-motion, and context-loss behavior.

Asset handling: Copy complete-shelf-v2.html byte-for-byte; its authored media remains embedded in the document.

## Local component example

Import the copied local component rather than a package entrypoint:

```tsx
import { CompleteShelfLandingPage } from "./effects/complete-shelf-landing-page/CompleteShelfLandingPage";
import "./effects/complete-shelf-landing-page/styles.css";

export function Scene() {
  return <div className="effect-frame"><CompleteShelfLandingPage /></div>;
}
```

## Core renderer pattern

This excerpt documents orchestration only. Copy the exact shader, geometry, pass, and interaction code from the verified source files.

```tsx
<LandingPageFrame title="Complete Shelf" sourceUrl="/landing-pages/complete-shelf-v2.html" />
```

## Behavior contract

- Runtime: Full HTML + DOM/CSS + Three.js r165
- Passes: 1 sandboxed full-document renderer
- Interaction: Original pointer, keyboard, scroll, navigation, and book interactions
- Assets: All visual and media data remains embedded in the original HTML
- **document** (fixed): Complete original complete-shelf-v2.html, byte-for-byte
- **sourceUrl** (fixed): /landing-pages/complete-shelf-v2.html
- **headingFont** (optional): Iowan Old Style | Instrument Serif | Newsreader | Geist
- **bodyFont** (optional): Inter | Geist | Newsreader | Instrument Serif
- **headingWeight** (optional): 400 | 500 | 600
- **bodyWeight** (optional): 400 | 500 | 600
- **primaryColor** (optional): Hex color
- **typography** (optional): Heading size + body size + heading letter spacing
- **layout** (responsive): Original full landing page inside the preview frame
- **interaction** (original): Scroll + pointer + keyboard + book controls
- **assets** (embedded): Original embedded media

## Verification

1. Compare the rendered composition, animation timing, pointer behavior, and state transitions with the source implementation.
2. Exercise resize, high-DPI, mobile/coarse-pointer, reduced-motion, tab visibility, and WebGL context-loss paths where applicable.
3. Confirm every animation frame, observer, listener, geometry, buffer, texture, framebuffer, material, and renderer is released on teardown.
4. Check the browser console and confirm the effect renders at native-or-better backing resolution.

## Guardrails

- Do not substitute a visually similar package, demo, shader, or runtime.
- Do not approximate, reconstruct, or simplify the authored GLSL, render passes, geometry, interaction state, or assets.
- Keep exact source and asset hashes under regression tests when the source project provides them.
- Adapt only the surrounding host boundary needed by the target project; keep renderer behavior intact.
