# CLAUDE.md

This file gives AI assistants full context about this project.
Read it entirely before making any changes.

---

## Project overview

**`thai-postal-code`** is a zero-dependency TypeScript library. Given a 5-digit Thai postal code, it returns the matching province, district, and list of sub-districts — with bilingual Thai and English names and coordinates.

**Key design decisions:**

- **Synchronous API.** All public functions are sync. Data is indexed at module load time — no lazy init, no async overhead on first call.
- **Postal index is primary.** `lookupByPostalCode` hits `POSTAL_INDEX` (a `Map<string, RawThaiRecord[]>`) for an O(1) lookup. No linear scan.
- **Pre-built search rows.** `SEARCH_ROWS` stores English fields pre-lowercased so `searchAddress()` never calls `.toLowerCase()` at query time.
- **Dual data sources.** Primary: bilingual address data from `thailand-geography-json`. Secondary: `lat`/`lng` per postal code from a separate repo, merged at bundle time.
- **Zero runtime deps.** The bundled data file is a TS module with a typed array literal. No external fetches at runtime.

---

## Repository layout

```
thai-postal-code/
├── src/
│   ├── data/
│   │   └── thai-postal-code.data.ts  ← AUTO-GENERATED — never edit
│   ├── types/
│   │   └── index.ts                  ← All exported TypeScript types
│   ├── utils/
│   │   ├── loader.ts                 ← Module-load-time index construction
│   │   └── lookup.ts                 ← All public API functions
│   └── index.ts                      ← Barrel re-export
├── scripts/
│   ├── bundle-data.ts                ← Fetches 4 upstream sources, joins, writes data file
│   ├── validate-data.ts              ← Validates the generated data file
│   └── tsconfig.json                 ← Extends tsconfig.scripts.json (VS Code fix)
├── tests/
│   └── lookup.test.ts                ← bun:test suite (all tests are sync)
├── .github/
│   └── workflows/
│       ├── ci.yml                    ← CI on every PR (Bun matrix: 1.1, latest)
│       └── publish.yml               ← Publishes to npm + JSR on GitHub Release
├── bunfig.toml                       ← bun test config + coverage
├── CLAUDE.md                         ← This file
├── README.md
├── package.json
├── tsconfig.json                     ← src/ only; types: ["bun-types", "node"]
├── tsconfig.scripts.json             ← scripts/ only; types: ["bun-types", "node"]
├── tsup.config.ts                    ← Dual CJS + ESM build via tsup
├── jsr.json                          ← JSR publish config (points at src/index.ts)
├── eslint.config.ts                  ← ESLint flat config (defineConfig + projectService)
└── .prettierrc
```

---

## Data sources

### Primary — `thailand-geography-data/thailand-geography-json`
https://github.com/thailand-geography-data/thailand-geography-json

Three JSON files fetched from `src/`:

| File | Key fields |
|------|-----------|
| `provinces.json` | `provinceCode`, `provinceNameEn`, `provinceNameTh` |
| `districts.json` | `provinceCode`, `districtCode`, `districtNameEn`, `districtNameTh`, `postalCode` |
| `subdistricts.json` | `provinceCode`, `districtCode`, `subdistrictCode`, `subdistrictNameEn`, `subdistrictNameTh`, `postalCode` |

Join keys: `provinceCode` (province → subdistrict) and `districtCode` (district → subdistrict).
The join is done bottom-up from `subdistricts.json` — each subdistrict row becomes one output record.

### Secondary — `rathpanyowat/Thai-zip-code-latitude-and-longitude`
https://github.com/rathpanyowat/Thai-zip-code-latitude-and-longitude

Single `data.json`. Fields used: `zip` (string), `lat` (number), `lng` (number).
Merged into output by matching `zip` (zero-padded to 5 digits) against `postalCode`.
Codes absent from this dataset produce `lat: null, lng: null` in the output.

### Output shape — `RawThaiRecord`

```ts
interface RawThaiRecord {
  postalCode: string;        // "10200"
  provinceCode: number;      // 10
  provinceNameTh: string;    // "กรุงเทพมหานคร"
  provinceNameEn: string;    // "Bangkok"
  districtCode: number;      // 1001
  districtNameTh: string;    // "พระนคร"
  districtNameEn: string;    // "Phra Nakhon"
  subdistrictCode: number;   // 100101
  subdistrictNameTh: string; // "พระบรมมหาราชวัง"
  subdistrictNameEn: string; // "Phra Borom Maha Ratchawang"
  lat: number | null;        // 13.7560243 or null
  lng: number | null;        // 100.4986793 or null
}
```

---

## Runtime indexes (loader.ts)

Two structures are built synchronously at module load time:

### `POSTAL_INDEX` — `Map<string, RawThaiRecord[]>`
- Key: 5-digit postal code string
- Value: all rows sharing that postal code (one per subdistrict)
- Used by: `lookupByPostalCode`, `autofillByPostalCode`, `getSubdistrictsByPostalCode`, `listAllPostalCodes`
- Access: `getPostalIndex()` — returns `ReadonlyMap`
- The map is `Object.freeze`d after construction

### `SEARCH_ROWS` — `SearchEntry[]`
- Flat array, one entry per `RawThaiRecord`
- English name fields are pre-lowercased at build time
- Used by: `searchAddress()`
- Access: `getSearchRows()` — returns `readonly SearchEntry[]`

Both structures are module-level constants — they exist for the entire process lifetime and are never rebuilt.

---

## Public API (all synchronous)

```ts
// Postal code → full result (province + district + subdistricts + lat/lng)
lookupByPostalCode(postalCode: string, options?: LookupOptions): ThaiAddressResult | null

// Postal code → autofill result (province + district + subdistricts, no lat/lng)
autofillByPostalCode(postalCode: string, options?: LookupOptions): ThaiAutofillResult | null

// Postal code → subdistrict list only, never throws
getSubdistrictsByPostalCode(postalCode: string): SubdistrictEntry[]

// All 77 provinces sorted by Thai name
listProvinces(): { nameTh: string; nameEn: string }[]

// All districts for a province sorted by Thai name
listDistrictsByProvince(provinceNameTh: string): { nameTh: string; nameEn: string; postalCode: string }[]

// Substring search — Thai + English names + postal code
searchAddress(query: string, limit?: number): ThaiSearchResult[]

// All postal codes sorted ascending
listAllPostalCodes(): string[]
```

### LookupOptions
```ts
{ silent?: boolean }  // default false — throw on unknown/invalid; true → return null
```

---

## Data pipeline

```bash
bun run data:fetch      # fetch 4 sources, join, write src/data/thai-postal-code.data.ts
bun run data:validate   # validate the generated file
bun run data:pipeline   # both in sequence (recommended)
```

`src/data/thai-postal-code.data.ts` is **gitignored**. CI runs `data:pipeline` before every build. Never commit this file.

`bundle-data.ts` fetches all 4 sources with `Promise.all`, then:
1. Builds `provinceMap: Map<provinceCode, SourceProvince>`
2. Builds `districtMap: Map<districtCode, SourceDistrict>`
3. Builds `latLngMap: Map<postalCode, {lat, lng}>`
4. Iterates subdistricts, joins upward, enriches with coords, outputs `RawThaiRecord[]`

`validate-data.ts` checks: schema completeness, 5-digit postal code format, no duplicate `(postalCode + subdistrictCode)` pairs, the district invariant (one postal code → one province + district), province coverage (≥ 77), bilingual name completeness, coordinate bounding box (lat 4.5–21.5, lng 97–106).

---

## tsconfig split — why

`scripts/` uses `node:fs/promises` and `node:path` which need `@types/node`.
Adding `"node"` to the root `tsconfig.json` causes conflicts with `bun-types` globals.

Solution:
- `tsconfig.json` — `src/` only, `types: ["bun-types", "node"]`
- `tsconfig.scripts.json` — `scripts/` only, extends base, `types: ["bun-types", "node"]`
- `scripts/tsconfig.json` — one-liner `{ "extends": "../tsconfig.scripts.json" }` so VS Code resolves the correct config when a script file is open

---

## All commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install devDependencies |
| `bun run data:pipeline` | Fetch all sources, join, validate |
| `bun run data:fetch` | Fetch + join only |
| `bun run data:validate` | Validate generated file only |
| `bun run build` | Compile `dist/` (CJS + ESM + `.d.ts`) via tsup |
| `bun run build:check` | Type-check `src/` only |
| `bun run build:check:scripts` | Type-check `scripts/` only |
| `bun run build:check:all` | Type-check both |
| `bun test` | Run full test suite |
| `bun test --watch` | Watch mode |
| `bun test --coverage` | With V8 coverage |
| `bun run lint` | ESLint |
| `bun run lint:fix` | ESLint with auto-fix |
| `bun run format` | Prettier (write) |
| `bun run format:check` | Prettier (check — used in CI) |
| `bun run clean` | Remove `dist/` |

**Full setup from scratch:**
```bash
bun install
bun run data:pipeline
bun run build:check:all
bun test
bun run build
```

---

## Conventions

- **No runtime dependencies.** The library ships as a self-contained ESM/CJS bundle with data inlined as a TypeScript literal array.
- **Sync only.** Do not introduce `async` into any public function in `lookup.ts`. The indexes are built at module load; lookups must remain synchronous.
- **Bun-native scripts.** Use `import.meta.dir` (not `__dirname`), `Bun.write` (not `fs.writeFile`) in scripts.
- **No `.js` extensions in imports.** `Bundler` module resolution handles bare `.ts` paths.
- **Strict TypeScript.** Do not weaken `tsconfig.json` — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` are all on.
- **Bilingual.** Every public-facing type exposes both `NameTh` and `NameEn` fields.
- **ESLint flat config.** `eslint.config.ts` uses ESLint's `defineConfig()` (v9.22+) with `typescript-eslint` `recommendedTypeChecked`. `tseslint.config()` is deprecated — do not use it. Uses `parserOptions.projectService: true` (replaces `project: true`). `tests/**` excluded from linting. Lint runs on `src/` only via `bun run lint`.
- **`lat`/`lng` are `number | null`.** Never assume coordinates exist — always handle `null`.

---

## Adding a new public function

1. Implement in `src/utils/lookup.ts` — sync only, use `getPostalIndex()` or `getSearchRows()` or `loadData()`
2. Export from `src/index.ts`
3. Add types to `src/types/index.ts` if needed
4. Add tests in `tests/lookup.test.ts` — no `await`, assert the result is not a `Promise`
5. Document in `README.md`
6. Update this file if the data model or architecture changes

---

## Release process

1. Bump `version` in `package.json` and `jsr.json` (must match)
2. Commit: `chore: release vX.Y.Z`
3. Create a GitHub Release tagged `vX.Y.Z`
4. `publish.yml` runs automatically → npm + JSR

---

## Placeholders to replace before publishing

| Placeholder | Replace with |
|-------------|--------------|
| `YOUR_USERNAME` | antronic |
| `YOUR_SCOPE` | @jirachai |
| `YOUR_NAME` in LICENSE | Jirachai Chansiavnon |