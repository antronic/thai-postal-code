import type {
  LookupOptions,
  RawThaiRecord,
  SubdistrictEntry,
  ThaiAddressResult,
  ThaiAutofillResult,
  ThaiSearchResult,
} from '../types/index'
import { getPostalIndex, getSearchRows, loadData } from './loader'

// ─── Internal helpers ────────────────────────────────────────────────────────

function normalizePostalCode(input: string): string {
  return input.trim()
}

function buildAddressResult(postalCode: string, records: RawThaiRecord[]): ThaiAddressResult {
  const first = records[0]
  if (first === undefined) {
    throw new Error(`[thai-postal-code] No records for postal code: "${postalCode}"`)
  }

  // Deduplicate subdistricts by subdistrictCode, then sort by Thai name.
  const seen = new Set<number>()
  const subdistricts: SubdistrictEntry[] = []
  for (const r of records) {
    if (!seen.has(r.subdistrictCode)) {
      seen.add(r.subdistrictCode)
      subdistricts.push({
        subdistrictCode: r.subdistrictCode,
        subdistrictNameTh: r.subdistrictNameTh,
        subdistrictNameEn: r.subdistrictNameEn,
      })
    }
  }
  subdistricts.sort((a, b) => a.subdistrictNameTh.localeCompare(b.subdistrictNameTh, 'th'))

  return {
    postalCode,
    provinceNameTh: first.provinceNameTh,
    provinceNameEn: first.provinceNameEn,
    districtNameTh: first.districtNameTh,
    districtNameEn: first.districtNameEn,
    subdistricts,
    lat: first.lat,
    lng: first.lng,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up province, district, lat/lng, and sub-district list by postal code.
 *
 * Uses the pre-built postal index — O(1) hash lookup, no linear scan.
 *
 * @param postalCode - 5-digit Thai postal code, e.g. `"10330"`
 * @param options    - `{ silent: true }` to return `null` instead of throwing
 *
 * @example
 * ```ts
 * const result = lookupByPostalCode("10330");
 * result.provinceNameTh  // "กรุงเทพมหานคร"
 * result.districtNameEn  // "Pathum Wan"
 * result.subdistricts    // [{ subdistrictNameTh: "ลุมพินี", ... }, ...]
 * result.lat             // 13.7401666
 * ```
 */
export function lookupByPostalCode(
  postalCode: string,
  options: LookupOptions = {}
): ThaiAddressResult | null {
  const { silent = false } = options
  const code = normalizePostalCode(postalCode)

  if (!/^\d{5}$/.test(code)) {
    if (silent) return null
    throw new Error(
      `[thai-postal-code] Invalid format: "${postalCode}". Expected a 5-digit string.`
    )
  }

  const records = getPostalIndex().get(code)

  if (records === undefined || records.length === 0) {
    if (silent) return null
    throw new Error(`[thai-postal-code] Postal code not found: "${postalCode}".`)
  }

  return buildAddressResult(code, records)
}

/**
 * Lightweight autofill — returns province, district, and sub-district list.
 * Does not include lat/lng. Use `lookupByPostalCode` if you need coordinates.
 *
 * @example
 * ```ts
 * const fill = autofillByPostalCode("50000");
 * fill.provinceNameTh  // "เชียงใหม่"
 * fill.subdistricts    // [{ subdistrictNameTh: "ช้างคลาน", ... }, ...]
 * ```
 */
export function autofillByPostalCode(
  postalCode: string,
  options: LookupOptions = {}
): ThaiAutofillResult | null {
  const result = lookupByPostalCode(postalCode, options)
  if (result === null) return null

  return {
    postalCode: result.postalCode,
    provinceNameTh: result.provinceNameTh,
    provinceNameEn: result.provinceNameEn,
    districtNameTh: result.districtNameTh,
    districtNameEn: result.districtNameEn,
    subdistricts: result.subdistricts,
  }
}

/**
 * Returns the sub-district list for a postal code.
 * Never throws — returns `[]` for unknown or invalid codes.
 *
 * @example
 * ```ts
 * const subs = getSubdistrictsByPostalCode("10330");
 * // [{ subdistrictNameTh: "ลุมพินี", subdistrictNameEn: "Lumphini", subdistrictCode: 103007 }]
 * ```
 */
export function getSubdistrictsByPostalCode(postalCode: string): SubdistrictEntry[] {
  return lookupByPostalCode(postalCode, { silent: true })?.subdistricts ?? []
}

/**
 * Returns all 77 Thai provinces, sorted by Thai name.
 * Each entry has both Thai and English names.
 */
export function listProvinces(): { nameTh: string; nameEn: string }[] {
  const map = new Map<number, { nameTh: string; nameEn: string }>()
  for (const r of loadData()) {
    if (!map.has(r.provinceCode)) {
      map.set(r.provinceCode, {
        nameTh: r.provinceNameTh,
        nameEn: r.provinceNameEn,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'))
}

/**
 * Returns all districts for a province (matched by Thai name), sorted by Thai name.
 *
 * @param provinceNameTh - Province name in Thai, e.g. `"เชียงใหม่"`
 */
export function listDistrictsByProvince(
  provinceNameTh: string
): { nameTh: string; nameEn: string; postalCode: string }[] {
  const map = new Map<number, { nameTh: string; nameEn: string; postalCode: string }>()
  for (const r of loadData()) {
    if (r.provinceNameTh === provinceNameTh && !map.has(r.districtCode)) {
      map.set(r.districtCode, {
        nameTh: r.districtNameTh,
        nameEn: r.districtNameEn,
        postalCode: r.postalCode,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'))
}

/**
 * Text search across Thai and English names for province, district, and
 * sub-district, as well as the postal code itself.
 *
 * Uses the pre-built search rows — no repeated toLowerCase() at call time.
 * Case-insensitive for English fields; exact substring for Thai fields.
 *
 * @param query - Partial Thai or English text, or a postal code prefix
 * @param limit - Max results to return (default: 20)
 *
 * @example
 * ```ts
 * searchAddress("สีลม");    // Thai name match
 * searchAddress("Silom");   // English name match (case-insensitive)
 * searchAddress("10500");   // Postal code match
 * ```
 */
export function searchAddress(query: string, limit = 20): ThaiSearchResult[] {
  const raw = query.trim()
  if (raw.length === 0) return []

  const q = raw.toLowerCase()
  const results: ThaiSearchResult[] = []
  const rows = getSearchRows()

  for (let i = 0; i < rows.length; i++) {
    if (results.length >= limit) break

    const r = rows[i]!
    if (
      r.postalCode.includes(q) ||
      r.provinceNameTh.includes(raw) ||
      r.provinceNameEn.includes(q) ||
      r.districtNameTh.includes(raw) ||
      r.districtNameEn.includes(q) ||
      r.subdistrictNameTh.includes(raw) ||
      r.subdistrictNameEn.includes(q)
    ) {
      results.push({
        postalCode: r.postalCode,
        provinceNameTh: r.provinceNameTh,
        provinceNameEn: r.provinceNameEn,
        districtNameTh: r.districtNameTh,
        districtNameEn: r.districtNameEn,
        subdistrictNameTh: r.subdistrictNameTh,
        subdistrictNameEn: r.subdistrictNameEn,
        lat: r.lat,
        lng: r.lng,
      })
    }
  }

  return results
}

/**
 * Returns all postal codes in the dataset, sorted ascending.
 * Uses the postal index keys — O(n) where n = number of unique postal codes.
 */
export function listAllPostalCodes(): string[] {
  return [...getPostalIndex().keys()].sort()
}
