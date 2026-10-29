# Phase 46.33 — Bandha two-atmosphere correction

## Evidence and caveat
The user requested matching **Bandha Integrated Website v1.8**, especially its deep green-blue industrial design. The actual v1.8 Easy Preview and Complete Source archives were not present in the accessible filesystem or indexed files. Therefore this phase does **not** certify a pixel-exact match to v1.8. Do not describe these colors as extracted from v1.8.

The following colors were directly identified in the preserved **Bandha V25/V26** HTML source. These pages already contained an industrial/software dark color family alongside warm consulting tones:

| Role | Verified hexadecimal | Evidence in accessible source |
|---|---|---|
| Engineering / darkest | `#102123` | V25/V26 `v13-world-shift` gradient |
| Engineering / slate | `#1c3333` | V25/V26 `v13-world-shift` gradient |
| Blue-green industrial | `#113942` | V25 software workshop visual gradient |
| Midnight teal | `#09222e` | V25 software workshop visual gradient |
| Consulting paper | `#f3ede4` | V26 homepage `:root` |
| Consulting secondary paper | `#eae1d4` | V26 homepage `:root` |
| Consulting copper | `#b27850` | V26 homepage `:root` |
| Warm dark text | `#2a211d` | V26 homepage `:root` |
| Hairline | `#d9cbbc` | V26 homepage `:root` |

A prior **Bandha AIM Industrial Brand Moodboard** further confirms the *qualitative* blue-green + sage + copper + sand art direction, but it is not a substitute for the missing v1.8 source.

## Chosen implementation
- Deep teal sidebar and technical navigation, ivory main application surfaces, warm copper emphasis and walnut titles.
- COR, INS, draft note types retain textual labels; teal brand colors are not engineering authorization states.
- Documented preview records remain synthetic and in-memory; no approval or persistence claims.
- Existing DM Sans + Instrument Serif pairing is retained provisionally. The v1.8 font pairing was not verifiable in this session.
- Existing CSS is retained under a final override to avoid changing the old offline contracts and semantic behavior; style consolidation should remove legacy duplicate overrides after mounted React review.

## Follow-up needed for exact fidelity
Obtain Bandha_Integrated_Website_V1_8_Easy_Preview.zip or Bandha_Integrated_Website_V1_8_Complete_Source.zip and compare computed color/typography/surfaces against the actual source, including mobile. Only then claim exact match.
