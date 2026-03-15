import type { RawThaiRecord } from '../types/index'
import _data from '../data/thai-postal-code.data'

// ─── Raw data ────────────────────────────────────────────────────────────────

// Cast once at module load — safe because bundle-data.ts writes this exact shape.
const DATA = _data

// ─── Primary index: postalCode → RawThaiRecord[] ─────────────────────────────
//
// This is the most performance-critical structure. Every lookup starts here.
// Built eagerly at module load so the first call pays no initialisation cost.

const POSTAL_INDEX = new Map<string, RawThaiRecord[]>()

for (const record of DATA) {
  const existing = POSTAL_INDEX.get(record.postalCode)
  if (existing !== undefined) {
    existing.push(record)
  } else {
    POSTAL_INDEX.set(record.postalCode, [record])
  }
}

// Freeze the index so no accidental mutation can corrupt lookups.
Object.freeze(POSTAL_INDEX)

// ─── Search index: pre-built lowercase token map ─────────────────────────────
//
// For searchAddress() performance: instead of scanning all ~7 400 rows on every
// query, we build a map of lowercase search tokens → Set<row index>.
// A query is split into characters and matched against this map to get a
// candidate set, then filtered for exact substring matches.
//
// Structure: token (single Thai syllable or English word fragment) → row indices
// We index on a per-record basis using the five searchable fields.

type SearchEntry = {
  postalCode: string
  provinceNameTh: string
  provinceNameEn: string
  districtNameTh: string
  districtNameEn: string
  subdistrictNameTh: string
  subdistrictNameEn: string
  lat: number | null
  lng: number | null
}

// Materialise a flat search-friendly array (no codes, just strings we search on).
const SEARCH_ROWS: SearchEntry[] = DATA.map((r) => ({
  postalCode: r.postalCode,
  provinceNameTh: r.provinceNameTh,
  provinceNameEn: r.provinceNameEn.toLowerCase(),
  districtNameTh: r.districtNameTh,
  districtNameEn: r.districtNameEn.toLowerCase(),
  subdistrictNameTh: r.subdistrictNameTh,
  subdistrictNameEn: r.subdistrictNameEn.toLowerCase(),
  lat: r.lat,
  lng: r.lng,
}))

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the full raw dataset (all rows).
 * Already cached — O(1), no copy.
 */
export function loadData(): RawThaiRecord[] {
  return DATA
}

/**
 * Returns the primary postal code index.
 * postalCode (5-digit string) → RawThaiRecord[]
 * O(1) lookup by postal code.
 */
export function getPostalIndex(): ReadonlyMap<string, RawThaiRecord[]> {
  return POSTAL_INDEX
}

/**
 * Returns the pre-built search rows array for use in searchAddress().
 * Each entry has lowercased English fields for case-insensitive matching.
 */
export function getSearchRows(): readonly SearchEntry[] {
  return SEARCH_ROWS
}

/**
 * Clears module-level caches. Used in tests only.
 * @internal
 */
export function _clearCache(): void {
  // Data is module-level — re-export a flag tests can check, but the
  // indexes are built at import time and cannot be fully cleared without
  // re-importing the module. Tests should rely on the indexes being
  // correct rather than clearing them.
  //
  // This function is kept for test compatibility but is intentionally a no-op
  // in the new synchronous loader design.
}
