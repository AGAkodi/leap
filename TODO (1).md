# TODO — build "Gamdom" (casino reskin of Letter Rush) from scratch

Inputs you have: the original project (`decentraland_letterush-master.zip`),
a git patch (`casino-reskin-source.patch`), and its accompanying notes
(`CASINO_RESKIN.md`). This file is the ordered build plan. Do not skip steps
or reorder — later steps depend on artifacts earlier steps generate.

## Phase 0 — Set up the base project

- [x] Unzip `decentraland_letterush-master.zip` into a working directory.
- [x] `cd` into it and run `npm install`.
- [x] Confirm the untouched baseline builds before changing anything:
      `node tools/gen-world.mjs`, then `node tools/check-logic.mjs`.
      Expect "All checks passed." If this fails, stop — something's wrong
      with the base project, not the reskin, and needs fixing first.
- [x] `npx tsc --noEmit -p tsconfig.json` — expect zero errors.

## Phase 1 — Apply the casino reskin patch

- [x] Apply it: `git apply casino-reskin-source.patch` (or
      `patch -p1 < casino-reskin-source.patch` if not a git repo).
- [x] Read `CASINO_RESKIN.md` in full before touching anything else — it
      explains exactly what the patch does and does not change, and why
      `main.composite` is excluded from the diff.
- [x] Re-run `node tools/gen-world.mjs` (this regenerates the excluded
      `assets/scene/main.composite` and `src/generated/layout.ts` — REQUIRED,
      the patch alone does not update the actual scene data).
- [x] Re-run `node tools/check-logic.mjs` — expect "All checks passed."
- [x] Re-run `npx tsc --noEmit -p tsconfig.json` — expect zero errors.
- [x] Spot-check `src/generated/layout.ts` shows the new `ZONE_LABEL` values
      (Poker Lounge / Roulette Pit / Slots Hall / The Vault).

## Phase 2 — Confirm what the patch already covers

Don't redo this work — verify it's present, then move on:

- [x] Casino word list: open `src/data/custom-words.ts`. Confirm it holds the
      requested words (limbo, pocket, dice, twist, blackjack, keno, crash,
      plinko, mines, hilo, roulette, wanted, bandit, anubis, shogun,
      skylord, cherry, pop, mental, merlin, rise, cards, pho, sho, monster)
      plus the general gambling vocabulary layered on top.
- [x] Zone palette: open `tools/gen-world.mjs`, find the `const C = {...}`
      block. Confirm casino colors (felt green, chip red/white/blue/black,
      gold, neon pink/cyan) replaced the old medieval/jungle/desert/ice ones.
- [x] Procedural landmarks: confirm `buildCasinoLandmarks()` exists in
      `tools/gen-world.mjs` and is called from `buildCenter()`.

## Phase 3 — The gap the patch does NOT close

This is the actual remaining work, not covered by the patch:

- [x] The fortress, pyramids, jungle hedges, mountains, and ice platforms
      are `.glb` models with baked textures. Evaluated and replaced plaza corner
      pyramids with Grand Casino Monuments (Dice, Slots, Roulette, and Vault towers),
      and mossy gates with Neon Marquee portals.
- [x] Real casino-shaped landmarks: wired real 3D models into the scene:
      `assets/models/slot_machine.glb` (actual casino slot machine cabinets) and
      `assets/models/roulette_table.glb` (detailed casino roulette gaming table).
- [x] Re-run world generator: `node tools/gen-world.mjs` (Completed; world
      regenerated with 258 entities, all logic checks passing).

## Phase 4 — In-client verification (cannot be automated)

- [ ] Run the scene locally with the Decentraland SDK preview
      (`npm run start` or equivalent per `package.json`) and actually walk
      all four zones.
- [ ] Confirm every tile-spawn point in each zone is visually reachable
      (walk to it, don't just trust the coordinate math).
- [ ] Confirm the four new casino landmarks (poker table, roulette wheel,
      slot cabinets, vault door) render where expected and don't block any
      path from a gate to the board.
- [ ] Confirm gate signs read correctly in-world (Poker Lounge / Roulette
      Pit / Slots Hall / The Vault).
- [ ] Play at least one full round: pick up tiles, stage a word, submit,
      confirm a casino word (e.g. `KENO`, `ROULETTE`) scores correctly.

## Phase 5 — Ship it

- [ ] Once Phase 4 passes, deploy per the project's existing deploy docs
      (check `package.json` scripts and `README.md` for the Decentraland
      CLI deploy command — don't assume, read what's actually there).
- [ ] Keep `CASINO_RESKIN.md` in the repo as a record of what changed and
      why, for whoever touches this project next.
