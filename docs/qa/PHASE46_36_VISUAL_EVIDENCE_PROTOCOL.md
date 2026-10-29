# Phase 46.36 — Mounted Visual Evidence Protocol

## Identity: no synthetic screenshot substitution

The screenshot gate MUST navigate the running production Vite preview (port 4174), confirm the shipped index HTML and mounted React shell, inspect computed CSS custom properties, and save screenshots from a genuine Chromium page. `page.set_content`, `data:` mockups, screenshots from a standalone file, and injected engineering fixtures do **not** meet this gate.

## Required visual output

After all preceding release gates have passed, capture four states: unauthenticated landing desktop 1440×900, Asset Register desktop 1440×900, landing mobile 390×844, and Asset Register mobile 390×844. Verify screenshot SHA-256, no horizontal page overflow, no page errors, and Bandha v1.8 CSS tokens. Save the PNGs and evidence JSON in `qa/runtime/phase46-36-mounted-visuals/` and upload as a CI artifact. Do not commit unreviewed screenshot evidence as a substitute for a current run.

## Source authorization boundary

Default `main.tsx` mounts `<FutureAimApp />` without connected credentials; Asset Register is disconnected. This gate does not claim to photograph a populated Engineering Evidence Navigator, review an authorized COR/INS source, or approve any engineering case. The synthetic test fixtures in React/jsdom integration tests are isolated **tests**, never presented as production data.

## Release review

Inspect `qa/runtime/phase32-release-gates.json` for the actual current run. Expect the `mounted_chromium_visual_proof` gate only after Vite build, preview readiness, and the 78×4 browser audit. A trace that shows missing, blocked, or failed steps must not be labeled a passed integration milestone.
