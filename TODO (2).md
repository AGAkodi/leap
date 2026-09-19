# TODO — apply the casino MVP patch

The build is already done. This is not a "build from scratch" list — it's
an "integrate what's already been written and verify it" list. Don't
redesign or re-theme anything below; just apply, add files, and check.

## What you're integrating

One casino floor (no separate biomes/zones visually), slot machines and
roulette tables scattered across it, the board in the center, letter tiles
scattered around the floor. Game logic (pickup, staging, scoring,
dictionary) is untouched — only the environment changed.

## Phase 0 — Base project

- [x] Unzip `decentraland_letterush-master.zip` (the original) into a
      working directory, if not already done.
- [x] `cd` into it, run `npm install`.

## Phase 1 — Apply the patch

- [x] Apply `casino-reskin-source.patch`:
      `git apply casino-reskin-source.patch`
      (or `patch -p1 < casino-reskin-source.patch` if not a git repo).
      It's cumulative — applies straight to the original zip, no earlier
      patch needs to be applied first.

## Phase 2 — Add the model files

- [x] Create the folder if it doesn't exist: `mkdir -p assets/models`
- [x] Copy in the two required models:
      - `slot_machine.glb` → `assets/models/slot_machine.glb`
      - `roulette_table.glb` → `assets/models/roulette_table.glb`
- [ ] **More files may be added after this todo was written** — if you're
      given additional `.glb` files or other assets alongside this list,
      they go in `assets/models/` too, but do NOT wire a new file into
      `tools/gen-world.mjs` on your own judgment. Flag it and wait for
      instructions on where it's supposed to go — placement in the scene
      is a design decision, not something to infer from a filename.

## Phase 3 — Generate and verify

- [x] `npm run gen:world` — this writes `assets/scene/main.composite` and
      `src/generated/layout.ts` from the patched generator. REQUIRED — the
      patch alone does not update the actual scene data.
      Expect: `175 entities`, `anchors: N=49 S=49 E=49 W=49`, no errors.
      If it errors that a model is missing, Phase 2 wasn't completed —
      go back, don't work around it.
- [x] `npm run check` (`tools/check-logic.mjs`) — expect "All checks passed."
- [x] `npx tsc --noEmit -p tsconfig.json` — expect zero errors.

If any of these three fail, stop and report the exact error — don't guess
a fix by modifying `tools/gen-world.mjs` structurally. Something in Phase 1
or 2 likely didn't apply the way it was meant to.

## Phase 4 — In-client check (cannot be automated, do this yourself)

- [ ] Run the scene locally and walk the full floor.
- [ ] Confirm slot machines and roulette tables render right-side-up, on
      the floor (not floating or half-buried) — the code corrects each
      model's vertical offset based on its own measured bounding box, but
      hasn't been visually confirmed.
- [ ] Check the roulette table's height in particular — it measures 0.43m
      tall in the source file, which is short for a standing table. Decide
      if that's acceptable as-is.
- [ ] Confirm a few letter tiles are pickable near machines and on open
      floor tiles, and that at least one full round (pick up, stage,
      submit, score) works end to end.
- [ ] If any model's horizontal position looks off (a few meters from
      where it visually "should" sit), that's expected per
      `CASINO_RESKIN.md` — nudge the position in `buildCasinoZone()` in
      `tools/gen-world.mjs`, re-run `gen:world`, recheck.

## Phase 5 — Ship it

- [ ] Once Phase 4 looks right, deploy per the project's existing deploy
      docs (check `package.json` scripts / `README.md` — don't assume a
      command).
