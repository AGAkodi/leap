# Letter Rush → one casino floor (not four biomes)

`casino-reskin-source.patch` is a standard git unified diff, cumulative —
it applies directly to the ORIGINAL `decentraland_letterush-master.zip`,
you don't need to have applied any earlier patch first.

```bash
cd decentraland_letterush-master
git apply casino-reskin-source.patch   # or: patch -p1 < casino-reskin-source.patch
mkdir -p assets/models
cp models/slot_machine.glb assets/models/slot_machine.glb
cp models/roulette_table.glb assets/models/roulette_table.glb
npm install                            # if not already done
npm run gen:world                      # REQUIRED — see below
npm run check
```

## What changed from the last patch: this is a full redesign, not a reskin

The earlier version kept the four original biomes (fortress, jungle maze,
desert pyramid, mountains/ice) and just recolored them — same shapes, casino
palette. That's not what was asked for. This version removes all of that:

- **Every zone is now the same thing**: a flat casino floor, cycling slot
  machines / roulette tables / open walkway on a simple grid (8m spacing).
  No mazes, no mountains, no pyramids, no fortress. One consistent look
  across the whole map — `buildCasinoZone()` in `tools/gen-world.mjs`
  replaces the four separate `buildNorth/South/East/West()` functions.
- **~1,200 lines deleted** from `tools/gen-world.mjs` — every helper that
  only existed to build one of the old biomes (maze generation, mountain/
  rock/pine placement, the fortress and pyramid landmark code) is gone.
- **Game logic untouched.** `addAnchor(zone, x, y, z)` — the actual
  mechanism that makes a point a valid letter-tile spawn — doesn't care what
  geometry sits under it or how a player got there. The four zones
  (NORTH/SOUTH/EAST/WEST) still exist as the same 64x64m quadrants they
  always were, still feed `TILE_ANCHORS` the same way, still work with
  `src/tiles.ts`, scoring, the dictionary, staging/submit — none of that
  code was touched. Only what the zones look like changed.
- `tools/check-logic.mjs` had two checks updated (not removed to dodge a
  failure — genuinely rewritten) that were asserting the old biome naming
  convention ("Mountain" and "Ground" scenery must exist and survive mobile
  culling). Those scenery types don't exist anymore, so the checks now
  reflect that; the pyramid and floor culling-exemption checks are
  untouched and still pass.

## Why `gen:world` still has to be re-run

Same as before — `tools/gen-world.mjs` is a source file that WRITES
`assets/scene/main.composite` (the actual scene data) and
`src/generated/layout.ts`. The patch changes the generator; running it
produces the actual updated scene. Skipping this step means the source
changed but the world a player walks into didn't.

## The two real models

Copy them into `assets/models/` before running `gen:world` (paths above).
`buildCasinoZone()` throws a clear error at generation time if either file
is missing — treated as core geometry, not an optional decoration.

| | Slot machine | Roulette table |
|---|---|---|
| Triangles | ~10,000 | ~17,000 |
| Real-world size (w×h×d) | 1.13m × 1.99m × 0.95m | 1.29m × 0.43m × 1.04m |

Both models' pivots aren't centered on their mesh (checked against each
file's own glTF bounding box). The vertical offset is corrected in code
(`SLOT_MACHINE_Y`, `ROULETTE_TABLE_Y`), so both sit on the floor rather than
floating or half-buried. The horizontal (x/z) position may be off by up to
~1m from where the code aims — there's a full 8m grid cell of clearance
around every placement, so this is a "nudge the number if it looks off,"
not a "will clip through something" issue.

## Validated before packaging

- `git apply --check` — applies cleanly to a pristine copy of the original zip
- `npm run gen:world` — 175 entities, no errors, 49 tile anchors per zone
- `npm run check` (`tools/check-logic.mjs`) — all checks pass
- `npx tsc --noEmit` — zero type errors

## Still worth an in-client look

- Confirm the two models' actual placement/rotation reads right once you can
  see them (the x/z nudge above).
- The roulette table's measured height (0.43m) is short for a standing
  table — worth checking whether that's intentional or the model expects a
  separate stand.
- Walk all four zones once to confirm the open, flat layout feels right —
  this removed all verticality/parkour, which was a deliberate
  simplification ("something simple"), not an oversight, but worth
  confirming it's the amount of simple you wanted.
