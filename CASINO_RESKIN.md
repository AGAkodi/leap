# Letter Rush → casino reskin, as a patch

`casino-reskin-source.patch` is a standard git unified diff. Apply it against
the original `decentraland_letterush-master` project:

```bash
cd decentraland_letterush-master
git apply casino-reskin-source.patch   # or: patch -p1 < casino-reskin-source.patch
npm install                            # if not already done
npm run gen:world                      # REQUIRED — see below
npm run check
```

## Why `gen:world` has to be re-run

`tools/gen-world.mjs` is a *source* file for a procedural generator, not the
scene itself. It writes two build artifacts:

- `assets/scene/main.composite` — the actual entity/component data Decentraland
  loads
- `src/generated/layout.ts` — zone labels, spawn tables, etc. consumed by the
  game code at runtime

The patch changes the generator, but a regenerated `main.composite` is one
huge single-line JSON blob, so it's excluded from the diff as noise — instead,
running `npm run gen:world` after applying the patch produces it fresh.
Skipping this step means the source changes exist but the scene the game
actually renders is untouched.

## What's in the patch

**`tools/gen-world.mjs`**
- Recolored the `C` palette object from medieval/jungle/desert/ice tones to a
  casino palette, one key at a time, so every existing call site
  (`slab()`, `addFoundryPlatform()`, etc.) needed zero changes.
- Renamed the four gates/signs and `ZONE_LABEL`:
  WEST → Poker Lounge, EAST → Roulette Pit, SOUTH → Slots Hall, NORTH → The Vault.
- Added `buildCasinoLandmarks()`: four new decorative set-pieces (poker table
  + chips, a spinning roulette wheel, three glowing slot cabinets, a vault
  door with gold bars), placed in verified-clear floor space near each gate.
  These are plain box/cylinder primitives with real, recolorable materials.

**`src/dictionary.ts` + `src/data/custom-words.ts` (new file)**
- Added a small supplemental word list (~85 words: the casino terms you
  listed, e.g. `keno`, `plinko`, `roulette`, `blackjack`, plus general
  gambling vocabulary), checked before the main 178k-word dictionary on every
  lookup. Kept separate from the compiled dictionary so it survives a future
  `npm run gen:dict` regeneration untouched.

**`src/generated/layout.ts`**
- Included as generated output for reference, but will be overwritten by
  `npm run gen:world` anyway — no need to hand-apply it.

## What this patch does NOT change, on purpose

The fortress, pyramids, jungle hedges, mountains, and ice platforms are
external `.glb` models with their own baked-in textures. This generator has
no material-override path for GLB meshes, so those keep their original
medieval/jungle/desert/ice *shapes* — only the ground colors, signage, and
the four new landmarks carry the casino look. Reshaping those landmarks
themselves needs real casino `.glb` models (poker/slots/roulette-styled),
which weren't available to source and wire in here.

## Validated before packaging

- `git apply --check` — applies cleanly to a pristine copy
- `npm run gen:world` (both `--no-models` and full) — 228 entities, no errors
- `npm run check` (`tools/check-logic.mjs`) — all checks pass
- `npx tsc --noEmit` — zero type errors
