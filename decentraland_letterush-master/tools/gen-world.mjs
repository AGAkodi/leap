/**
 * Procedural world generator for "Scrabble Parkour".
 *
 * Emits:
 *   assets/scene/main.composite   — every static entity in the scene
 *   src/generated/layout.ts       — layout constants + tile spawn anchors used by runtime code
 *
 * Run with:  npm run gen:world      (or: node tools/gen-world.mjs)
 *
 * Everything is deterministic: change SEED to reroll the mazes / parkour courses.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SEED = 20260810
/**
 * GLB prop dressing (fetched via tools/fetch-models.sh) is layered on by
 * default. Pass --no-models to skip it and fall back to the bare procedural
 * geometry — e.g. before fetch-models.sh has been run, or for a faster
 * iteration loop that doesn't care about decoration.
 */
const WITH_MODELS = !process.argv.includes('--no-models')

/* ------------------------------------------------------------------ *
 * Deterministic RNG
 * ------------------------------------------------------------------ */
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
let rnd = mulberry32(SEED)
const rf = (lo, hi) => lo + rnd() * (hi - lo)
const ri = (lo, hi) => Math.floor(rf(lo, hi + 1))
const pick = (arr) => arr[ri(0, arr.length - 1)]

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */
const PARCEL = 16
const GRID = 12 // 12 x 12 parcels
const WORLD = GRID * PARCEL // 192 m
const BLOCK = 64 // each zone is 4 x 4 parcels

const ZONES = {
  CENTER: { x0: 64, z0: 64 },
  NORTH: { x0: 64, z0: 128 }, // ice / snow parkour
  SOUTH: { x0: 64, z0: 0 }, // egyptian desert tower
  EAST: { x0: 128, z0: 64 }, // jungle maze
  WEST: { x0: 0, z0: 64 } // industrial parkour
}
const CORNERS = [
  { x0: 0, z0: 0, name: 'SouthWest' },
  { x0: 128, z0: 0, name: 'SouthEast' },
  { x0: 0, z0: 128, name: 'NorthWest' },
  { x0: 128, z0: 128, name: 'NorthEast' }
]

// Scrabble board: 21 x 21 cells of 2 m, centred in the CENTER block.
const BOARD_N = 21
const CELL = 2
const BOARD_SPAN = BOARD_N * CELL // 42
const BOARD_X0 = ZONES.CENTER.x0 + (BLOCK - BOARD_SPAN) / 2 // 75
const BOARD_Z0 = ZONES.CENTER.z0 + (BLOCK - BOARD_SPAN) / 2 // 75
const BOARD_Y = 0.28 // top surface of a board cell

/* ------------------------------------------------------------------ *
 * Palette
 * ------------------------------------------------------------------ */
// Casino retheme: every key below keeps its original name (so every call
// site — slab(), addFoundryPlatform(), etc. — needed zero changes) but now
// carries a casino-appropriate colour instead of its original medieval /
// jungle / desert / ice value. GLB-based geometry (hedges, the fortress, the
// pyramids, mountains, trees, rocks, ice platforms) keeps its own baked
// material regardless of this table — see CASINO_RESKIN.md for what that
// means and doesn't mean visually.
const C = {
  // center / plaza — deep casino-carpet red + gold trim
  plazaStone: [0.42, 0.06, 0.08],
  aztecStone: [0.55, 0.48, 0.38],
  aztecDark: [0.14, 0.09, 0.07],
  aztecJade: [0.16, 0.55, 0.42],
  aztecGold: [0.83, 0.66, 0.22],
  boardFrame: [0.72, 0.55, 0.16],
  cellNormal: [0.85, 0.79, 0.63],
  cellDL: [0.55, 0.78, 0.92],
  cellTL: [0.16, 0.44, 0.78],
  cellDW: [0.94, 0.55, 0.55],
  cellTW: [0.83, 0.2, 0.18],
  cellStar: [0.95, 0.78, 0.25],
  // EAST — Roulette Pit (was jungle): black/red felt in place of foliage green
  jungleGround: [0.4, 0.03, 0.05],
  jungleHedge: [0.13, 0.42, 0.19],
  jungleHedge2: [0.17, 0.5, 0.24],
  jungleTrunk: [0.29, 0.21, 0.13],
  jungleLeaf: [0.2, 0.6, 0.25],
  jungleStone: [0.35, 0.4, 0.32],
  // WEST — Poker Lounge (was industrial foundry): green felt + walnut trim
  indGround: [0.04, 0.28, 0.15],
  indSteel: [0.45, 0.47, 0.5],
  indSteelDark: [0.28, 0.3, 0.33],
  indRust: [0.55, 0.31, 0.16],
  indYellow: [0.85, 0.68, 0.12],
  indPipe: [0.38, 0.4, 0.44],
  // SOUTH — Slots Hall (was desert tomb): warm amber/gold carpet
  sand: [0.62, 0.42, 0.1],
  sandstone: [0.78, 0.65, 0.4],
  sandstoneDark: [0.6, 0.48, 0.29],
  egyptGold: [0.87, 0.72, 0.28],
  egyptLapis: [0.4, 0.06, 0.42],
  // NORTH — The Vault (was ice/snow): cool silver-chrome + sapphire accent
  snow: [0.78, 0.8, 0.86],
  ice: [0.55, 0.62, 0.78],
  iceDeep: [0.08, 0.13, 0.42],
  rock: [0.42, 0.44, 0.48],
  rockDark: [0.3, 0.32, 0.36],
  // Shared casino accent colours for the new procedural landmarks below
  feltGreen: [0.04, 0.32, 0.16],
  chipRed: [0.72, 0.08, 0.1],
  chipWhite: [0.92, 0.92, 0.88],
  chipBlue: [0.08, 0.2, 0.65],
  chipBlack: [0.06, 0.06, 0.07],
  gold: [0.85, 0.68, 0.22],
  goldBright: [1, 0.82, 0.3],
  neonPink: [0.95, 0.1, 0.55],
  neonCyan: [0.1, 0.85, 0.9],
  woodDark: [0.22, 0.13, 0.07]
}

/* ------------------------------------------------------------------ *
 * Composite builder
 * ------------------------------------------------------------------ */
let nextId = 512
const transforms = {}
const meshRenderers = {}
const meshColliders = {}
const materials = {}
const names = {}
const textShapes = {}
const billboards = {}
const tweens = {}
const tweenSequences = {}
const gltfContainers = {}
const lightSources = {}

/**
 * Every entity still needs its own `core::Material` component entry — that's
 * an ECS invariant, not something a generator script can get around. What
 * WAS wasteful is that every one of those entries carried a brand new `pbr`
 * object, even when hundreds of entities (every "Ground" tile, every wall
 * segment of the same stone colour, ...) specify the exact same colour/
 * metallic/roughness/emissive combination. The scene's material budget is
 * counted against how many distinct materials get uploaded to the GPU, and
 * an engine can only recognise "these are the same material" cheaply if it's
 * actually the same value — so this interns every `pbr` object by its
 * content and hands out the shared instance instead of a fresh one each
 * time. Same visuals, far fewer distinct materials.
 */
const materialCache = new Map()
function internMaterial(pbr) {
  const key = JSON.stringify(pbr)
  let shared = materialCache.get(key)
  if (!shared) {
    shared = pbr
    materialCache.set(key, shared)
  }
  return shared
}

/** Noon. Seconds since midnight; the skybox is pinned here so nothing goes dark. */
const SKYBOX_FIXED_TIME = 43200
/**
 * Enclosed spaces get no sky light no matter what the skybox says, so interior
 * surfaces carry an emissive lift of their own albedo.
 *
 * This is doing more work than it looks: scene dynamic lights are NOT rendered
 * on mobile, so on a phone the braziers below contribute nothing and the lift is
 * the ONLY thing keeping the tomb navigable. Tuned to be readable with no lights
 * at all; on desktop the lights sit on top of it.
 */
const INTERIOR_LIFT = 0.55
const CORRIDOR_LIFT = 0.22

const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 }
function yawQuat(deg) {
  const h = (deg * Math.PI) / 360
  return { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) }
}
function eulerQuat(xDeg, yDeg, zDeg) {
  const hx = (xDeg * Math.PI) / 360
  const hy = (yDeg * Math.PI) / 360
  const hz = (zDeg * Math.PI) / 360
  const cx = Math.cos(hx),
    sx = Math.sin(hx)
  const cy = Math.cos(hy),
    sy = Math.sin(hy)
  const cz = Math.cos(hz),
    sz = Math.sin(hz)
  return {
    x: sx * cy * cz - cx * sy * sz,
    y: cx * sy * cz + sx * cy * sz,
    z: cx * cy * sz - sx * sy * cz,
    w: cx * cy * cz + sx * sy * sz
  }
}

const usedNames = new Set()
function uniqueName(base) {
  let n = base
  let i = 2
  while (usedNames.has(n)) n = `${base}_${i++}`
  usedNames.add(n)
  return n
}

/**
 * Add a primitive entity.
 * opts: { name, pos:[x,y,z], scale:[x,y,z], rot, mesh:'box'|'cylinder'|'sphere'|'plane',
 *         color, emissive, emissiveIntensity, metallic, roughness, collider:0|1|2|3,
 *         radiusTop, radiusBottom, text, fontSize, billboard, tween }
 */
function add(opts) {
  const id = String(nextId++)
  const [px, py, pz] = opts.pos
  const [sx, sy, sz] = opts.scale || [1, 1, 1]

  if (px < 0 || pz < 0 || px > WORLD || pz > WORLD) {
    throw new Error(`Out of bounds entity "${opts.name}" at ${px},${py},${pz}`)
  }

  transforms[id] = {
    json: {
      position: { x: r3(px), y: r3(py), z: r3(pz) },
      scale: { x: r3(sx), y: r3(sy), z: r3(sz) },
      rotation: opts.rot || IDENTITY_ROT,
      parent: 0
    }
  }
  names[id] = { json: { value: uniqueName(opts.name) } }

  const meshKind = opts.mesh || 'box'
  if (meshKind !== 'none') {
    meshRenderers[id] = { json: { mesh: meshJson(meshKind, opts) } }
  }
  if (opts.collider !== 0) {
    meshColliders[id] = {
      json: {
        collisionMask: opts.collider === undefined ? 2 : opts.collider,
        mesh: meshJson(meshKind === 'plane' ? 'box' : meshKind, opts)
      }
    }
  }
  if (opts.color) {
    const [r, g, b] = opts.color
    const pbr = {
      albedoColor: { r: r3(r), g: r3(g), b: r3(b), a: opts.alpha === undefined ? 1 : opts.alpha },
      metallic: opts.metallic === undefined ? 0 : opts.metallic,
      roughness: opts.roughness === undefined ? 0.85 : opts.roughness
    }
    // `lift` self-illuminates a surface with its own colour — the cheap way to
    // stop an enclosed room reading as pitch black.
    if (opts.lift) {
      pbr.emissiveColor = { r: r3(r), g: r3(g), b: r3(b) }
      pbr.emissiveIntensity = opts.lift
    }
    if (opts.emissive) {
      pbr.emissiveColor = { r: opts.emissive[0], g: opts.emissive[1], b: opts.emissive[2] }
      pbr.emissiveIntensity = opts.emissiveIntensity || 1.5
    }
    // A textured surface with no `textureTiling` (e.g. the board's baked
    // grid) uses the mesh's own default UVs directly — the whole face shows
    // the whole image once, since it's a single baked picture, not a
    // repeating material. `textureTiling: [x, y]` opts into TWM_REPEAT and
    // scales the UV so the image repeats that many times across the surface
    // instead of stretching one copy over it — for tileable materials like
    // sand/stone on walls whose size varies a lot (a short wall run and a
    // 20 m one would otherwise show the same single stretched copy).
    if (opts.textureSrc) {
      const texture = { src: opts.textureSrc }
      if (opts.textureTiling) {
        texture.wrapMode = 0 // TextureWrapMode.TWM_REPEAT
        texture.tiling = { x: opts.textureTiling[0], y: opts.textureTiling[1] }
      }
      pbr.texture = { tex: { $case: 'texture', texture } }
    }
    materials[id] = { json: { material: { $case: 'pbr', pbr: internMaterial(pbr) } } }
  }
  if (opts.text) {
    textShapes[id] = {
      json: {
        text: opts.text,
        fontSize: opts.fontSize || 4,
        textColor: { r: 1, g: 0.95, b: 0.8, a: 1 }
      }
    }
  }
  if (opts.light) {
    lightSources[id] = {
      json: {
        active: true,
        color: {
          r: opts.light.color[0],
          g: opts.light.color[1],
          b: opts.light.color[2]
        },
        intensity: opts.light.intensity,
        range: opts.light.range,
        shadow: false,
        type: { $case: 'point', point: {} }
      }
    }
  }
  if (opts.billboard) billboards[id] = { json: { billboardMode: opts.billboard } }
  if (opts.tween) tweens[id] = { json: opts.tween }
  if (opts.tweenSequence) tweenSequences[id] = { json: opts.tweenSequence }
  return id
}

function meshJson(kind, opts) {
  if (kind === 'cylinder') {
    return {
      $case: 'cylinder',
      cylinder: {
        radiusTop: opts.radiusTop === undefined ? 0.5 : opts.radiusTop,
        radiusBottom: opts.radiusBottom === undefined ? 0.5 : opts.radiusBottom
      }
    }
  }
  if (kind === 'sphere') return { $case: 'sphere', sphere: {} }
  // `uvs` must be present (even empty) or the protobuf encoder throws at build time.
  if (kind === 'plane') return { $case: 'plane', plane: { uvs: [] } }
  return { $case: 'box', box: { uvs: [] } }
}

/** Metres of surface per texture repeat, for tileable materials (sand, stone, ...). */
const TILE_METRES = 4
/** [x, y] repeat count for a `textureTiling`-driven surface of this world size. */
const tileRepeat = (widthM, heightM) => [
  Math.max(1, widthM / TILE_METRES),
  Math.max(1, heightM / TILE_METRES)
]

const r3 = (n) => Math.round(n * 1000) / 1000
/** Keep a coordinate safely inside the scene footprint. */
const clampWorld = (n, margin = 1) => Math.min(Math.max(n, margin), WORLD - margin)

/** Ground-level floor slab whose TOP surface sits at `top`. */
function slab(name, cx, cz, sx, sz, top, color, thickness = 0.4) {
  return add({
    name,
    pos: [cx, top - thickness / 2, cz],
    scale: [sx, thickness, sz],
    color,
    collider: 3
  })
}

/* ------------------------------------------------------------------ *
 * Optional GLB decoration
 * ------------------------------------------------------------------ */
const missingModels = new Set()

/** Place a downloaded GLB prop. No-ops if --no-models was passed, or the file doesn't exist. */
function addModel(name, slug, pos, opts = {}) {
  if (!WITH_MODELS) return null
  const src = `assets/Models/${slug}.glb`
  if (!existsSync(resolve(ROOT, src))) {
    missingModels.add(slug)
    return null
  }
  const id = add({
    name,
    pos,
    scale: opts.scale || [1, 1, 1],
    rot: opts.rot || IDENTITY_ROT,
    mesh: 'none',
    collider: 0
  })
  gltfContainers[id] = {
    json: {
      src,
      visibleMeshesCollisionMask: opts.solid ? 3 : 0,
      invisibleMeshesCollisionMask: 3
    }
  }
  return id
}

/* ------------------------------------------------------------------ *
 * Tile spawn anchors (collected per zone, written to layout.ts)
 * ------------------------------------------------------------------ */
const anchors = { NORTH: [], SOUTH: [], EAST: [], WEST: [] }
const addAnchor = (zone, x, y, z) => anchors[zone].push([r3(x), r3(y + 1.0), r3(z)])

/**
 * Landmark spawn points that always hold the SAME letter — unlike the
 * regular `anchors` pool (random position picked from the zone, random
 * letter drawn per spawn), these are meant as a fixed, findable reward: the
 * host always keeps a tile with this exact letter sitting at this exact
 * spot. Written to layout.ts as FIXED_LETTER_ANCHORS; host.ts pins one
 * dedicated tile entity per entry to it (see host.ts's reservation of the
 * last `FIXED_LETTER_ANCHORS.length` tileEntities indices).
 */
const fixedLetterAnchors = []
const addFixedLetterAnchor = (zone, letter, x, y, z) =>
  fixedLetterAnchors.push({ zone, letter, pos: [r3(x), r3(y + 1.0), r3(z)] })

/**
 * Spawn points that must ALWAYS hold a tile, every round — unlike the
 * regular `anchors` pool (which is just eligible for the random
 * zone-cursor/free-anchor picker, so it might go a while without a tile
 * actually landing there), these get a dedicated reserved tile entity, same
 * mechanism as fixedLetterAnchors above, except the letter is drawn at
 * random each time rather than fixed. Written to layout.ts as
 * GUARANTEED_SPAWNS; host.ts reserves one dedicated tileEntities index per
 * entry, placed immediately at the start of every round and respawned
 * immediately (not through the batched spawnTiles() cycle) whenever
 * collected.
 */
const guaranteedSpawns = []
const addGuaranteedSpawn = (zone, x, y, z) => guaranteedSpawns.push({ zone, pos: [r3(x), r3(y + 1.0), r3(z)] })

/* ================================================================== *
 * CENTER — Aztec plaza + 21x21 Scrabble board
 * ================================================================== */

/**
 * >>> ADJUST THE CORNER PYRAMID SCALE HERE. <<<
 *
 * The model's own geometry (assets/models/aztech_pyramid.glb, measured
 * directly from its glTF accessors) is small: at PYRAMID_SCALE = [1,1,1] the
 * visible mesh is only about 1.1 m wide/deep and 0.6 m tall, with its base
 * already sitting at local y = 0 — so PYRAMID_SCALE is a plain multiplier of
 * those numbers (e.g. 12 ⇒ roughly 13 m wide/deep, 7 m tall) and PYRAMID_Y
 * shouldn't need to move to compensate for scale.
 *
 * The old stacked-slab pyramid this replaces was ~13 m wide at the base and
 * ~5.2 m tall, which is where the starting value of 12 came from — tune it
 * to taste once you can see the actual model in-world.
 */
const PYRAMID_MODEL_SRC = 'assets/models/aztech_pyramid.glb'
const PYRAMID_SCALE = [12, 12, 12]
const PYRAMID_ROT = IDENTITY_ROT
const PYRAMID_Y = 0.05 // plaza floor top — matches slab('Plaza Floor', ...) below

/**
 * assets/models/arch.glb replaces the primitive post+lintel gates at the
 * plaza's 4 zone entrances. Its own pivot sits at the base centre of the
 * opening (measured minY = -0.0674, negligible — flat ground placement, same
 * as the trees/mountains/pine). Native size is close to square (width
 * 1.0125 x height 1.0184 x depth 0.189, all measured from the glTF
 * accessors), so ARCH_TARGET_HEIGHT alone drives a uniform scale and the
 * opening stays roughly as wide as it is tall.
 *
 * It ships its own dedicated "*_collider" nodes (one per post + the lintel),
 * so — same convention as the pyramid/mountains/platform — no explicit
 * collision mask is set below.
 *
 * >>> ADJUST GATE SIZE HERE <<<
 */
const ARCH_MODEL_SRC = 'assets/models/arch.glb'
const ARCH_NATIVE_HEIGHT = 1.0184
const ARCH_TARGET_HEIGHT = 7 // metres — matches the old post+lintel gate's overall height
if (!existsSync(resolve(ROOT, ARCH_MODEL_SRC))) {
  throw new Error(`Missing ${ARCH_MODEL_SRC} — the plaza's 4 gateways need this model.`)
}

// Premium-square pattern, defined on the 11x11 top-left quadrant and mirrored.
const key = (a, b) => a * 100 + b
const TW = new Set([key(0, 0), key(0, 7), key(7, 0), key(0, 10), key(10, 0), key(7, 7)])
const DW = new Set([
  key(1, 1), key(2, 2), key(3, 3), key(4, 4), key(5, 5), key(6, 6), key(8, 8), key(9, 9)
])
const TL = new Set([
  key(1, 5), key(5, 1), key(1, 9), key(9, 1), key(5, 9), key(9, 5), key(3, 9), key(9, 3)
])
const DL = new Set([
  key(0, 3), key(3, 0), key(2, 6), key(6, 2), key(3, 7), key(7, 3),
  key(6, 10), key(10, 6), key(2, 10), key(10, 2), key(8, 4), key(4, 8)
])

/** 0 = normal, 1 = DL, 2 = TL, 3 = DW, 4 = TW, 5 = centre star */
function premiumAt(row, col) {
  if (row === 10 && col === 10) return 5
  const qr = Math.min(row, BOARD_N - 1 - row)
  const qc = Math.min(col, BOARD_N - 1 - col)
  const k = key(qr, qc)
  if (TW.has(k)) return 4
  if (DW.has(k)) return 3
  if (TL.has(k)) return 2
  if (DL.has(k)) return 1
  return 0
}
function buildCenter() {
  const { x0, z0 } = ZONES.CENTER
  const cx = x0 + BLOCK / 2
  const cz = z0 + BLOCK / 2

  slab('Plaza Floor', cx, cz, BLOCK, BLOCK, 0.05, C.plazaStone, 0.5)

  // Raised board podium + frame
  slab('Board Podium', cx, cz, BOARD_SPAN + 6, BOARD_SPAN + 6, 0.16, C.aztecDark, 0.4)
  slab('Board Base', cx, cz, BOARD_SPAN + 1.2, BOARD_SPAN + 1.2, 0.2, C.boardFrame, 0.2)

  // The 441 cells used to each be their own individually-coloured entity — one
  // Material component apiece — which alone was closing in on the scene's
  // material budget. The whole board (grid lines AND premium-square colours)
  // is now one baked texture (assets/textures/grid.png, maintained directly by
  // hand) painted across a single entity: 441 materials down to 1.
  //
  // premiumAt() itself is still exported as CELL_PREMIUM to
  // src/generated/layout.ts — scoring logic (board.ts) needs to know where
  // the bonus squares are regardless of how they're drawn, it just no
  // longer drives an entity here.
  add({
    name: 'Board Cells Base',
    pos: [cx, BOARD_Y - 0.04, cz],
    scale: [BOARD_SPAN, 0.08, BOARD_SPAN],
    color: [1, 1, 1],
    textureSrc: 'assets/textures/grid.png',
    roughness: 0.8,
    collider: 3
  })

  // Aztec pyramids at the four plaza corners — a single hand-placed GLB
  // (assets/models/aztech_pyramid.glb), replacing the old 4-step stacked-slab
  // primitive. Unlike the decorative props in the four zones (addModel(),
  // skipped entirely if --no-models is passed or the file's missing), this
  // is core plaza geometry now, so it's placed directly and unconditionally
  // — the scene shouldn't lose its corner landmarks over a flag or a missed
  // download.
  if (!existsSync(resolve(ROOT, PYRAMID_MODEL_SRC))) {
    throw new Error(`Missing ${PYRAMID_MODEL_SRC} — the plaza's corner pyramids need this model.`)
  }
  const pyramidSpots = [
    [x0 + 8, z0 + 8], [x0 + BLOCK - 8, z0 + 8],
    [x0 + 8, z0 + BLOCK - 8], [x0 + BLOCK - 8, z0 + BLOCK - 8]
  ]
  for (const [px, pz] of pyramidSpots) {
    const id = add({
      name: 'Aztec Pyramid',
      pos: [px, PYRAMID_Y, pz],
      scale: PYRAMID_SCALE,
      rot: PYRAMID_ROT,
      mesh: 'none', // geometry comes from the glTF below, not a primitive
      collider: 0 // collision comes from the model's own collider mesh (see gltfContainers below), not a generic box
    })
    // No explicit collision masks — PBGltfContainer's own defaults
    // (visibleMeshesCollisionMask: 0, invisibleMeshesCollisionMask: CL_POINTER
    // | CL_PHYSICS) already do exactly what this model wants: collide against
    // its dedicated low-poly "obj_collider" node, not the detailed visible
    // mesh. Setting them explicitly here would just be restating the default.
    gltfContainers[id] = { json: { src: PYRAMID_MODEL_SRC } }
  }

  // The glyph pillar ring that used to circle the board here (7x "Aztec
  // Pillar" + "Aztec Pillar Glyph" primitives, radius 28.5m from board
  // centre) was removed: at that radius two of the seven pillars land only
  // ~6.5m from a corner pyramid's footprint edge — about the same as the
  // pyramid's own half-width at its current scale — so they read as
  // clashing/overlapping the pyramid. It dated back to when the corner
  // pyramids were small stacked-slab primitives; now that they're a much
  // bigger GLB landmark, the ring is redundant clutter as well as a clash.

  // Four ceremonial gateways aligned with the four gameplay zones — arch.glb
  // (ARCH_MODEL_SRC, above) replaces the old primitive post+lintel pairs.
  // The per-zone lintel tint (g.color) doesn't carry over: the GLB uses its
  // own single baked material, so there's no per-instance recolor the way a
  // primitive's `color` field allowed. The floating zone-name Sign is kept
  // for wayfinding, just repositioned to sit above the new arch height.
  const gates = [
    { name: 'Gate North (The Vault)', x: cx, z: z0 + BLOCK - 1.5, yaw: 0 },
    { name: 'Gate South (Slots Hall)', x: cx, z: z0 + 1.5, yaw: 0 },
    { name: 'Gate East (Roulette Pit)', x: x0 + BLOCK - 1.5, z: cz, yaw: 90 },
    { name: 'Gate West (Poker Lounge)', x: x0 + 1.5, z: cz, yaw: 90 }
  ]
  const archScale = ARCH_TARGET_HEIGHT / ARCH_NATIVE_HEIGHT
  for (const g of gates) {
    const id = add({
      name: g.name,
      pos: [g.x, 0.05, g.z],
      scale: [archScale, archScale, archScale],
      rot: yawQuat(g.yaw),
      mesh: 'none', // geometry comes from the glTF below, not a primitive
      collider: 0
    })
    gltfContainers[id] = { json: { src: ARCH_MODEL_SRC } }
    add({
      name: `${g.name} Sign`,
      pos: [g.x, ARCH_TARGET_HEIGHT + 1.2, g.z],
      scale: [1, 1, 1],
      mesh: 'none',
      collider: 0,
      text: g.name.replace('Gate ', ''),
      fontSize: 4,
      billboard: 2
    })
  }

  buildCasinoLandmarks(x0, z0, cx, cz)
}

/**
 * Casino retheme landmarks — one per gate, in the clear "corner strip"
 * between the plaza edge and the raised board podium (podium spans
 * x0+8..x0+56 / z0+8..z0+56, and each corner pyramid sits right at a podium
 * corner with roughly a 7 m footprint — see the pyramid-ring removal note
 * above buildCenter's gates). Every spot below sits well outside both, and
 * off the straight walking line from its gate to the board, so nothing here
 * risks blocking a path or clipping the podium/pyramids.
 *
 * These are pure box/cylinder primitives with their own Material component
 * (unlike the fortress/pyramid/hedge GLBs elsewhere, which carry their own
 * baked textures this generator can't recolor) — the actual "you're in a
 * casino now" visual identity, since the walkable zone geometry itself keeps
 * its original medieval/jungle/desert/ice shapes.
 */
function buildCasinoLandmarks(x0, z0, cx, cz) {
  for (const src of [SLOT_MACHINE_MODEL_SRC, ROULETTE_TABLE_MODEL_SRC]) {
    if (!existsSync(resolve(ROOT, src))) {
      throw new Error(`Missing ${src} — the casino landmarks need this model.`)
    }
  }

  const addChip = (px, py, pz, color, r = 0.32, h = 0.22) =>
    add({
      name: 'Casino Chip Stack',
      pos: [px, py, pz],
      scale: [r * 2, h, r * 2],
      mesh: 'cylinder',
      color,
      metallic: 0.1,
      roughness: 0.4,
      collider: 0
    })

  // West strip — Poker Lounge preview: a round felt table with four chip
  // stacks at its edge.
  {
    const tx = x0 + 4
    const tz = cz - 8
    add({ name: 'Poker Table Felt', pos: [tx, 0.75, tz], scale: [2.6, 0.12, 2.6], mesh: 'cylinder', color: C.feltGreen, roughness: 0.55, collider: 3 })
    add({ name: 'Poker Table Rim', pos: [tx, 0.66, tz], scale: [2.9, 0.1, 2.9], mesh: 'cylinder', color: C.woodDark, roughness: 0.5, collider: 0 })
    add({ name: 'Poker Table Leg', pos: [tx, 0.33, tz], scale: [0.5, 0.66, 0.5], mesh: 'cylinder', color: C.woodDark, collider: 0 })
    const chipColors = [C.chipRed, C.chipWhite, C.chipBlue, C.chipBlack]
    for (let i = 0; i < 4; i++) {
      const ang = i * (Math.PI / 2) + Math.PI / 4
      addChip(tx + Math.cos(ang) * 1.55, 0.86, tz + Math.sin(ang) * 1.55, chipColors[i])
    }
  }

  // East strip — Roulette Pit preview: the real roulette-table model
  // (assets/models/roulette_table.glb). Its own pivot isn't centred on the
  // mesh (world bbox ~1.29x0.43x1.04 m, offset from origin) — placement
  // below corrects for its height only; a small x/z nudge once you see it
  // in-client is expected and safe (there's several metres of clearance on
  // every side of this spot).
  {
    const wx = x0 + BLOCK - 4
    const wz = cz + 8
    const id = add({
      name: 'Roulette Table',
      pos: [wx, ROULETTE_TABLE_Y, wz],
      scale: [1, 1, 1],
      mesh: 'none', // geometry comes from the glTF below, not a primitive
      collider: 0 // collision comes from the model's own visible mesh (see visibleMeshesCollisionMask below)
    })
    gltfContainers[id] = { json: { src: ROULETTE_TABLE_MODEL_SRC, visibleMeshesCollisionMask: 3 } }
  }

  // South strip — Slots Hall preview: three of the real slot-machine model
  // (assets/models/slot_machine.glb) in a row, same spacing as the
  // procedural cabinets they replace. Its pivot sits near the model's
  // vertical centre (world bbox ~1.13x1.99x0.95 m), so SLOT_MACHINE_Y lifts
  // it so the cabinet's base — not its middle — sits on the floor.
  {
    const sz = z0 + 4
    for (let i = 0; i < 3; i++) {
      const sx = cx - 10 + i * 2.6
      const id = add({
        name: 'Slot Machine',
        pos: [sx, SLOT_MACHINE_Y, sz],
        scale: [1, 1, 1],
        mesh: 'none',
        collider: 0
      })
      gltfContainers[id] = { json: { src: SLOT_MACHINE_MODEL_SRC, visibleMeshesCollisionMask: 3 } }
    }
  }

  // North strip — The Vault preview: a gold-trimmed vault door flanked by
  // stacked gold bars.
  {
    const vx = cx + 10
    const vz = z0 + BLOCK - 4
    add({ name: 'Vault Door', pos: [vx, 1.4, vz], scale: [2.4, 2.8, 0.35], mesh: 'cylinder', color: C.rock, metallic: 0.5, roughness: 0.35, collider: 3 })
    add({ name: 'Vault Door Rim', pos: [vx, 1.4, vz - 0.02], scale: [2.6, 3.0, 0.1], mesh: 'cylinder', color: C.gold, metallic: 0.5, roughness: 0.3, collider: 0 })
    add({ name: 'Vault Door Handle', pos: [vx, 1.4, vz + 0.35], scale: [0.55, 0.55, 0.55], mesh: 'cylinder', color: C.goldBright, emissive: C.goldBright, emissiveIntensity: 0.5, collider: 0 })
    for (let side = -1; side <= 1; side += 2) {
      for (let stack = 0; stack < 3; stack++) {
        add({
          name: 'Gold Bar',
          pos: [vx + side * 1.7, 0.15 + stack * 0.16, vz + 1.0],
          scale: [0.5, 0.15, 0.28],
          color: C.goldBright,
          metallic: 0.6,
          roughness: 0.25,
          collider: stack === 0 ? 3 : 0
        })
      }
    }
  }
}


/* ================================================================== *
 * Casino floor — shared by every outer zone. One consistent look
 * everywhere: flat casino-carpet floor with slot machines and roulette
 * tables scattered across it. This replaces the four separate biomes
 * (fortress/industrial, jungle maze, desert pyramid, ice/mountains) that
 * used to live here — per explicit request, this is one casino map, not
 * four different worlds joined by portals.
 *
 * Kept deliberately simple: a flat slab (no parkour verticality, no maze
 * walls) with props on a regular grid. `addAnchor()` doesn't care what
 * geometry a point sits on or how a player got there — it just records a
 * candidate letter-tile spawn point — so this needs zero special handling
 * to plug into the existing pickup/scoring logic in src/tiles.ts et al.
 * ================================================================== */

/** Real casino models (user-supplied Sketchfab exports). Both keep their
 * own baked materials/textures, same as the old fortress/pyramid models —
 * not gated by --no-models, since buildCasinoZone() depends on them.
 *
 * Y offsets correct for each model's pivot, computed from its glTF
 * accessor bounding box (not eyeballed): the slot machine's pivot sits
 * near its vertical MIDDLE (world bbox y: -0.994..0.999), so it needs
 * lifting by ~its half-height for the cabinet's base to sit on the floor.
 * The roulette table's pivot sits near its BASE already (world bbox y:
 * -0.181..0.251), so it only needs a small lift. Neither model's x/z pivot
 * is centred on its mesh, so a small x/z nudge once seen in-client is
 * expected — there's a full CASINO_GRID_STEP of clearance around every
 * placement below, so this is a cosmetic nudge, not a collision risk.
 */
const SLOT_MACHINE_MODEL_SRC = 'assets/models/slot_machine.glb'
const SLOT_MACHINE_Y = 0.994
const ROULETTE_TABLE_MODEL_SRC = 'assets/models/roulette_table.glb'
const ROULETTE_TABLE_Y = 0.181

/** Metres between prop slots, both axes. */
const CASINO_GRID_STEP = 8
/** Keep every prop this far from a zone's own edge — clears the open
 * boundary into CENTER on the inner side, and the outer world edge on the
 * other three sides. */
const CASINO_GRID_MARGIN = 6

/**
 * One 64x64 m zone: flat casino floor, then a grid of prop slots cycling
 * slot machine / roulette table / open walkway (with a plain anchor). The
 * cycle order is offset per zone (via `phase`) purely so all four zones
 * don't line up on an identical pattern — it has no effect on gameplay.
 */
function buildCasinoZone(zoneName, x0, z0, phase = 0) {
  const cx = x0 + BLOCK / 2
  const cz = z0 + BLOCK / 2
  slab(`${zoneName} Casino Floor`, cx, cz, BLOCK, BLOCK, 0.05, C.plazaStone, 0.5)

  let i = phase
  for (let gx = x0 + CASINO_GRID_MARGIN; gx <= x0 + BLOCK - CASINO_GRID_MARGIN; gx += CASINO_GRID_STEP) {
    for (let gz = z0 + CASINO_GRID_MARGIN; gz <= z0 + BLOCK - CASINO_GRID_MARGIN; gz += CASINO_GRID_STEP) {
      const slot = i % 3
      i++
      if (slot === 0) {
        const id = add({
          name: 'Slot Machine',
          pos: [gx, SLOT_MACHINE_Y, gz],
          scale: [1, 1, 1],
          rot: yawQuat(180),
          mesh: 'none', // geometry comes from the glTF below, not a primitive
          collider: 0 // collision comes from the model's own visible mesh (see visibleMeshesCollisionMask below)
        })
        gltfContainers[id] = { json: { src: SLOT_MACHINE_MODEL_SRC, visibleMeshesCollisionMask: 3 } }
        addAnchor(zoneName, gx + 1.4, 0.05, gz) // beside the cabinet, not inside its collider
      } else if (slot === 1) {
        const id = add({
          name: 'Roulette Table',
          pos: [gx, ROULETTE_TABLE_Y, gz],
          scale: [1, 1, 1],
          mesh: 'none',
          collider: 0
        })
        gltfContainers[id] = { json: { src: ROULETTE_TABLE_MODEL_SRC, visibleMeshesCollisionMask: 3 } }
        addAnchor(zoneName, gx, 0.05, gz + 1.4)
      } else {
        // Open walkway tile — no prop, just a spawn point, so tiles aren't
        // exclusively glued to machines.
        addAnchor(zoneName, gx, 0.05, gz)
      }
    }
  }
}

/** The four diagonal corner blocks outside the NORTH/SOUTH/EAST/WEST zones
 * — pure backdrop, no gameplay, no anchors. Flat casino floor here too, so
 * there's no leftover mountain/rock scenery visible from anywhere in the
 * world. */
function buildCorners() {
  for (const corner of CORNERS) {
    const { x0, z0, name } = corner
    const cx = x0 + BLOCK / 2
    const cz = z0 + BLOCK / 2
    slab(`${name} Floor`, cx, cz, BLOCK, BLOCK, 0.05, C.plazaStone, 0.5)
  }
}


/* ================================================================== *
 * Optional GLB dressing, scattered along the tile anchors of each zone
 * ================================================================== */
function buildDecoration() {
  if (!WITH_MODELS) return

  // The 70-instance EAST ground scatter (fern/jungle-plant-06/parque, later
  // just jungle-plant-06) and the WEST/SOUTH/NORTH prop scatter were all
  // dropped per explicit request — too busy/ugly. The only jungle-plant-06
  // left is the hard-capped-at-3 wall sprinkle up in buildEast() (see
  // MAX_WALL_PLANTS). Nothing left to scatter here for now.
}

/* ================================================================== *
 * Emit
 * ================================================================== */
buildCenter()
buildCasinoZone('EAST', ZONES.EAST.x0, ZONES.EAST.z0, 0)
buildCasinoZone('WEST', ZONES.WEST.x0, ZONES.WEST.z0, 1)
buildCasinoZone('SOUTH', ZONES.SOUTH.x0, ZONES.SOUTH.z0, 2)
buildCasinoZone('NORTH', ZONES.NORTH.x0, ZONES.NORTH.z0, 0)
buildCorners()
buildDecoration()

const components = []
// Non-core components (anything not prefixed `core::`) must carry their jsonSchema
// or the SDK build cannot resolve the component definition.
const JSON_SCHEMAS = {
  'core-schema::Name': {
    type: 'object',
    properties: { value: { type: 'string', serializationType: 'utf8-string' } },
    serializationType: 'map'
  }
}
const push = (name, data) => {
  if (!Object.keys(data).length) return
  const entry = { name, data }
  if (JSON_SCHEMAS[name]) entry.jsonSchema = JSON_SCHEMAS[name]
  components.push(entry)
}
push('core::Transform', transforms)
push('core::GltfContainer', gltfContainers)
push('core::LightSource', lightSources)
push('core::MeshRenderer', meshRenderers)
push('core::MeshCollider', meshColliders)
push('core::Material', materials)
push('core::TextShape', textShapes)
push('core::Billboard', billboards)
push('core::Tween', tweens)
push('core::TweenSequence', tweenSequences)
push('core-schema::Name', names)

const composite = { version: 1, components }
mkdirSync(resolve(ROOT, 'assets/scene'), { recursive: true })
writeFileSync(resolve(ROOT, 'assets/scene/main.composite'), JSON.stringify(composite))

// Trim anchor lists to keep the generated module small but still varied.
function thin(list, max) {
  if (list.length <= max) return list
  const out = []
  const stride = list.length / max
  for (let i = 0; i < max; i++) out.push(list[Math.floor(i * stride)])
  return out
}
const anchorsOut = {
  NORTH: thin(anchors.NORTH, 90),
  SOUTH: thin(anchors.SOUTH, 110),
  EAST: thin(anchors.EAST, 110),
  WEST: thin(anchors.WEST, 90)
}

const layoutTs = `// AUTO-GENERATED by tools/gen-world.mjs — do not edit by hand.
// Regenerate with: npm run gen:world

export const PARCEL_SIZE = ${PARCEL}
export const PARCEL_GRID = ${GRID}
export const WORLD_SIZE = ${WORLD}
export const BLOCK_SIZE = ${BLOCK}

export const BOARD_N = ${BOARD_N}
export const BOARD_CELL_SIZE = ${CELL}
export const BOARD_X0 = ${BOARD_X0}
export const BOARD_Z0 = ${BOARD_Z0}
export const BOARD_Y = ${BOARD_Y}
export const BOARD_CELLS = ${BOARD_N * BOARD_N}

/** Skybox time of day, in seconds since midnight. 43200 = noon. */
export const SKYBOX_FIXED_TIME = ${SKYBOX_FIXED_TIME}

export const ZONE_NAMES = ['NORTH', 'SOUTH', 'EAST', 'WEST'] as const
export type ZoneName = (typeof ZONE_NAMES)[number]

export const ZONE_LABEL: Record<ZoneName, string> = {
  NORTH: 'The Vault',
  SOUTH: 'Slots Hall',
  EAST: 'Roulette Pit',
  WEST: 'Poker Lounge'
}

/** Candidate tile spawn positions (already offset ~1 m above the surface). */
export const TILE_ANCHORS: Record<ZoneName, [number, number, number][]> = {
  NORTH: ${JSON.stringify(anchorsOut.NORTH)},
  SOUTH: ${JSON.stringify(anchorsOut.SOUTH)},
  EAST: ${JSON.stringify(anchorsOut.EAST)},
  WEST: ${JSON.stringify(anchorsOut.WEST)}
}

/** Landmark spawn points that always hold the same letter (see gen-world.mjs's
 * addFixedLetterAnchor) — host.ts pins one dedicated tile entity per entry. */
export const FIXED_LETTER_ANCHORS: { zone: ZoneName; letter: string; pos: [number, number, number] }[] = ${JSON.stringify(fixedLetterAnchors)}

/** Spawn points that must always hold SOME tile (random letter) every round —
 * see gen-world.mjs's addGuaranteedSpawn. host.ts reserves one dedicated
 * tile entity per entry, same mechanism as FIXED_LETTER_ANCHORS above. */
export const GUARANTEED_SPAWNS: { zone: ZoneName; pos: [number, number, number] }[] = ${JSON.stringify(guaranteedSpawns)}

/** Premium multiplier map, one entry per board cell (0 normal, 1 DL, 2 TL, 3 DW, 4 TW, 5 star). */
export const CELL_PREMIUM: number[] = ${JSON.stringify(
  Array.from({ length: BOARD_N * BOARD_N }, (_, i) => premiumAt(Math.floor(i / BOARD_N), i % BOARD_N))
)}
`
mkdirSync(resolve(ROOT, 'src/generated'), { recursive: true })
writeFileSync(resolve(ROOT, 'src/generated/layout.ts'), layoutTs)

const bytes = JSON.stringify(composite).length
console.log(
  `main.composite: ${nextId - 512} entities, ${(bytes / 1024 / 1024).toFixed(2)} MB\n` +
    `anchors: N=${anchorsOut.NORTH.length} S=${anchorsOut.SOUTH.length} ` +
    `E=${anchorsOut.EAST.length} W=${anchorsOut.WEST.length}\n` +
    `lights: ${Object.keys(lightSources).length}   skybox: fixed at ${SKYBOX_FIXED_TIME}s (noon)\n` +
    `GLB props: ${WITH_MODELS ? Object.keys(gltfContainers).length : 'disabled (--no-models)'}`
)
if (missingModels.size) {
  console.log(
    `\nMissing GLBs (run tools/fetch-models.sh first): ${Array.from(missingModels).join(', ')}`
  )
}
