/**
 * scripts/bundle-data.ts
 *
 * Fetches data from two upstream sources and merges them:
 *
 * PRIMARY  — thailand-geography-data/thailand-geography-json
 *   provinces.json + districts.json + subdistricts.json
 *   Provides: bilingual names, province/district/subdistrict codes, postalCode
 *
 * SECONDARY — rathpanyowat/Thai-zip-code-latitude-and-longitude
 *   data.json
 *   Provides: lat/lng per postal code (best-effort — not all codes present)
 *
 * Join key: postalCode (5-digit string)
 *
 * Run via: bun run data:fetch
 */

import { mkdir } from "fs/promises";
import { join, dirname } from "path";

// ─── Source URLs ──────────────────────────────────────────────────────────────

const GEO_BASE =
  "https://raw.githubusercontent.com/thailand-geography-data/thailand-geography-json/main/src";

const LATLONG_URL =
  "https://raw.githubusercontent.com/rathpanyowat/Thai-zip-code-latitude-and-longitude/master/data.json";

const OUTPUT_PATH = join(import.meta.dir, "../src/data/thai-postal-code.data.ts");

// ─── Source shapes ────────────────────────────────────────────────────────────

interface SourceProvince {
  id: number;
  provinceCode: number;
  provinceNameEn: string;
  provinceNameTh: string;
}

interface SourceDistrict {
  id: number;
  provinceCode: number;
  districtCode: number;
  districtNameEn: string;
  districtNameTh: string;
  postalCode: number;
}

interface SourceSubdistrict {
  id: number;
  provinceCode: number;
  districtCode: number;
  subdistrictCode: number;
  subdistrictNameEn: string;
  subdistrictNameTh: string;
  postalCode: number;
}

interface SourceLatLng {
  id: string;
  zip: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
}

// ─── Output shape (matches RawThaiRecord in src/types/index.ts) ───────────────

interface OutputRecord {
  postalCode: string;
  provinceCode: number;
  provinceNameTh: string;
  provinceNameEn: string;
  districtCode: number;
  districtNameTh: string;
  districtNameEn: string;
  subdistrictCode: number;
  subdistrictNameTh: string;
  subdistrictNameEn: string;
  lat: number | null;
  lng: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, label: string): Promise<T> {
  console.log(`⬇  Fetching ${label}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${label}: ${res.status} ${res.statusText}\n   ${url}`);
  }
  const data = await res.json() as T;
  if (!Array.isArray(data)) {
    throw new Error(`Expected array for ${label}, got ${typeof data}`);
  }
  console.log(`   ✓ ${(data as unknown[]).length} records`);
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Thai Postal Code — data bundler\n");

  // 1. Fetch all four sources in parallel
  const [provinces, districts, subdistricts, latLngData] = await Promise.all([
    fetchJson<SourceProvince[]>(`${GEO_BASE}/provinces.json`, "provinces.json"),
    fetchJson<SourceDistrict[]>(`${GEO_BASE}/districts.json`, "districts.json"),
    fetchJson<SourceSubdistrict[]>(`${GEO_BASE}/subdistricts.json`, "subdistricts.json"),
    fetchJson<SourceLatLng[]>(LATLONG_URL, "lat-lng data.json"),
  ]);

  // 2. Build lookup maps
  const provinceMap = new Map<number, SourceProvince>();
  for (const p of provinces) {
    provinceMap.set(p.provinceCode, p);
  }

  const districtMap = new Map<number, SourceDistrict>();
  for (const d of districts) {
    districtMap.set(d.districtCode, d);
  }

  // lat/lng map: postalCode (zero-padded 5-digit) → { lat, lng }
  // The old source uses field "zip" (string, may have leading zeros already)
  const latLngMap = new Map<string, { lat: number; lng: number }>();
  for (const row of latLngData) {
    const zip = String(row.zip).padStart(5, "0");
    if (!latLngMap.has(zip)) {
      latLngMap.set(zip, { lat: row.lat, lng: row.lng });
    }
  }

  console.log(`\n   Lat/lng coverage: ${latLngMap.size} postal codes in secondary source`);

  // 3. Join: each subdistrict row → one output record
  const records: OutputRecord[] = [];
  const joinWarnings: string[] = [];

  for (const sub of subdistricts) {
    const province = provinceMap.get(sub.provinceCode);
    const district = districtMap.get(sub.districtCode);

    if (province === undefined) {
      joinWarnings.push(`subdistrict id=${sub.id}: unknown provinceCode=${sub.provinceCode}`);
      continue;
    }
    if (district === undefined) {
      joinWarnings.push(`subdistrict id=${sub.id}: unknown districtCode=${sub.districtCode}`);
      continue;
    }

    const postalCode = String(sub.postalCode).padStart(5, "0");
    const coords = latLngMap.get(postalCode) ?? null;

    records.push({
      postalCode,
      provinceCode:      sub.provinceCode,
      provinceNameTh:    province.provinceNameTh.trim(),
      provinceNameEn:    province.provinceNameEn.trim(),
      districtCode:      sub.districtCode,
      districtNameTh:    district.districtNameTh.trim(),
      districtNameEn:    district.districtNameEn.trim(),
      subdistrictCode:   sub.subdistrictCode,
      subdistrictNameTh: sub.subdistrictNameTh.trim(),
      subdistrictNameEn: sub.subdistrictNameEn.trim(),
      lat:               coords?.lat ?? null,
      lng:               coords?.lng ?? null,
    });
  }

  if (joinWarnings.length > 0) {
    console.warn(`\n⚠  ${joinWarnings.length} join warning(s):`);
    joinWarnings.slice(0, 10).forEach((w) => console.warn(`   ${w}`));
    if (joinWarnings.length > 10) console.warn(`   ... and ${joinWarnings.length - 10} more`);
  }

  // 4. Coverage stats
  const uniquePostalCodes  = new Set(records.map((r) => r.postalCode));
  const uniqueProvinces    = new Set(records.map((r) => r.provinceCode));
  const uniqueDistricts    = new Set(records.map((r) => r.districtCode));
  const uniqueSubdistricts = new Set(records.map((r) => r.subdistrictCode));
  const withCoords         = records.filter((r) => r.lat !== null).length;
  const coordCoverage      = ((withCoords / records.length) * 100).toFixed(1);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Join summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total rows           : ${records.length}
  Unique postal codes  : ${uniquePostalCodes.size}
  Unique provinces     : ${uniqueProvinces.size}   (expected 77)
  Unique districts     : ${uniqueDistricts.size}
  Unique subdistricts  : ${uniqueSubdistricts.size}
  Rows with lat/lng    : ${withCoords} / ${records.length} (${coordCoverage}%)
  Join failures        : ${joinWarnings.length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (uniqueProvinces.size !== 77) {
    console.warn(`\n⚠  Expected 77 provinces, got ${uniqueProvinces.size}`);
  }

  if (records.length === 0) {
    throw new Error("No records produced — aborting");
  }

  // 5. Write output
  const output = `// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Primary source:   https://github.com/thailand-geography-data/thailand-geography-json
// Secondary source: https://github.com/rathpanyowat/Thai-zip-code-latitude-and-longitude
// Generated at: ${new Date().toISOString()}

import type { RawThaiRecord } from '../types/index'

const data: RawThaiRecord[] = ${JSON.stringify(records, null, 2)}

export default data
`;

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await Bun.write(OUTPUT_PATH, output);

  console.log(`\n✓  Written to: ${OUTPUT_PATH}`);
  console.log(`✓  Done\n`);
}

main().catch((err: unknown) => {
  console.error("\n✗  bundle-data failed:", err);
  process.exit(1);
});