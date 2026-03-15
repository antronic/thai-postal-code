/**
 * scripts/validate-data.ts
 *
 * Validates src/data/thai-postal-code.data.ts against structural
 * and domain invariants.
 *
 * Exits 0 on success, 1 on any violation.
 *
 * Run via: bun run data:validate
 */

import { join } from "path";

const DATA_PATH = join(import.meta.dir, "../src/data/thai-postal-code.data.ts");

interface RawRecord {
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

function fail(msg: string): never {
  console.error(`\n✗  FAIL  ${msg}`);
  process.exit(1);
}
function warn(msg: string): void { console.warn(`⚠  WARN  ${msg}`); }
function pass(msg: string): void { console.log(`✓  ${msg}`); }

async function loadRecords(): Promise<RawRecord[]> {
  const file = Bun.file(DATA_PATH);
  if (!(await file.exists())) {
    fail(`Data file not found: ${DATA_PATH}\n   Run: bun run data:fetch`);
  }
  const mod = await import("../src/data/thai-postal-code.data");
  const data = mod.default as unknown;
  if (!Array.isArray(data)) fail("Expected data default export to be an array");
  return data as RawRecord[];
}

function checkSchema(records: RawRecord[]): void {
  const REQUIRED: (keyof RawRecord)[] = [
    "postalCode",
    "provinceCode", "provinceNameTh", "provinceNameEn",
    "districtCode",  "districtNameTh",  "districtNameEn",
    "subdistrictCode", "subdistrictNameTh", "subdistrictNameEn",
  ];
  let malformed = 0;
  for (let i = 0; i < records.length; i++) {
    const r = records[i] as RawRecord;
    for (const field of REQUIRED) {
      if (r[field] === undefined || r[field] === null || r[field] === "") {
        console.error(`  Row ${i}: missing "${field}"`);
        if (++malformed >= 5) fail("Schema check aborted after 5 errors");
      }
    }
  }
  if (malformed > 0) fail(`${malformed} record(s) failed schema check`);
  pass(`Schema — all ${records.length} records have required fields`);
}

function checkPostalCodeFormat(records: RawRecord[]): void {
  const invalid = records.filter((r) => !/^\d{5}$/.test(r.postalCode));
  if (invalid.length > 0) {
    invalid.slice(0, 5).forEach((r) => console.error(`  Bad postalCode: "${r.postalCode}"`));
    fail(`${invalid.length} record(s) have non-5-digit postalCodes`);
  }
  pass(`Postal code format — all postalCodes are 5-digit strings`);
}

function checkNoDuplicateRows(records: RawRecord[]): void {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const r of records) {
    const key = `${r.postalCode}|${r.subdistrictCode}`;
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  if (dupes.length > 0) {
    dupes.slice(0, 5).forEach((k) => console.error(`  Duplicate: ${k}`));
    fail(`${dupes.length} duplicate (postalCode + subdistrictCode) pair(s)`);
  }
  pass(`Dedup — no duplicate (postalCode + subdistrictCode) pairs`);
}

function checkPostalToDistrictInvariant(records: RawRecord[]): void {
  const zipMap = new Map<string, Set<string>>();
  for (const r of records) {
    const key = `${r.provinceCode}|${r.districtCode}`;
    const s = zipMap.get(r.postalCode) ?? new Set();
    s.add(key);
    zipMap.set(r.postalCode, s);
  }
  const violations: string[] = [];
  for (const [zip, districts] of zipMap.entries()) {
    if (districts.size > 1) {
      violations.push(
        `  postalCode ${zip} → ${districts.size} province|district combos:\n` +
        [...districts].map((d) => `    → ${d}`).join("\n")
      );
    }
  }
  if (violations.length > 0) {
    violations.slice(0, 3).forEach((v) => console.error(v));
    warn(`${violations.length} postalCode(s) map to multiple districts (may be upstream edge cases)`);
  } else {
    pass(`District invariant — every postalCode maps to exactly 1 province + district`);
  }
}

function checkCoverage(records: RawRecord[]): void {
  const uniqueProvinces = new Set(records.map((r) => r.provinceCode));
  if (uniqueProvinces.size < 77) {
    warn(`Only ${uniqueProvinces.size} provinces found — expected 77`);
  } else {
    pass(`Province coverage — ${uniqueProvinces.size} / 77`);
  }
  pass(`Records — ${new Set(records.map((r) => r.postalCode)).size} postal codes, ` +
       `${new Set(records.map((r) => r.districtCode)).size} districts, ` +
       `${new Set(records.map((r) => r.subdistrictCode)).size} subdistricts`);
}

function checkBilingualNames(records: RawRecord[]): void {
  const missing = records.filter(
    (r) => !r.provinceNameEn || !r.districtNameEn || !r.subdistrictNameEn
  );
  if (missing.length > 0) {
    warn(`${missing.length} record(s) missing English name fields`);
  } else {
    pass(`Bilingual names — all records have Thai + English names`);
  }
}

function checkCoordinates(records: RawRecord[]): void {
  // Thailand bounding box: lat 4.5–21.5°N, lng 97–106°E
  const LAT = { min: 4.5, max: 21.5 };
  const LNG = { min: 97.0, max: 106.0 };

  const withCoords = records.filter((r) => r.lat !== null);
  const nullCount  = records.length - withCoords.length;

  const outOfBounds = withCoords.filter(
    (r) => r.lat! < LAT.min || r.lat! > LAT.max || r.lng! < LNG.min || r.lng! > LNG.max
  );

  const coverage = ((withCoords.length / records.length) * 100).toFixed(1);

  if (nullCount > 0) {
    warn(`${nullCount} record(s) have null lat/lng (postal codes absent from secondary source)`);
  }

  if (outOfBounds.length > 0) {
    outOfBounds.slice(0, 5).forEach((r) =>
      console.error(`  Out-of-bounds: postalCode=${r.postalCode} lat=${r.lat} lng=${r.lng}`)
    );
    fail(`${outOfBounds.length} record(s) have coordinates outside Thailand's bounding box`);
  }

  pass(`Coordinates — ${withCoords.length} / ${records.length} rows have lat/lng (${coverage}%)`);
}

function printSummary(records: RawRecord[]): void {
  const uniqueZips   = new Set(records.map((r) => r.postalCode));
  const uniqueProv   = new Set(records.map((r) => r.provinceCode));
  const uniqueDist   = new Set(records.map((r) => r.districtCode));
  const uniqueSubs   = new Set(records.map((r) => r.subdistrictCode));
  const withCoords   = records.filter((r) => r.lat !== null).length;

  const zipToSubs = new Map<string, Set<number>>();
  for (const r of records) {
    const s = zipToSubs.get(r.postalCode) ?? new Set();
    s.add(r.subdistrictCode);
    zipToSubs.set(r.postalCode, s);
  }
  const counts = [...zipToSubs.values()].map((s) => s.size);
  const avg = (counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
  const max = Math.max(...counts);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Data summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total rows              : ${records.length}
  Unique postal codes     : ${uniqueZips.size}
  Unique provinces        : ${uniqueProv.size}
  Unique districts        : ${uniqueDist.size}
  Unique subdistricts     : ${uniqueSubs.size}
  Avg subdistricts/zip    : ${avg}
  Max subdistricts/zip    : ${max}
  Rows with lat/lng       : ${withCoords} / ${records.length}
  Bilingual names         : ✓ Thai + English
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

async function main(): Promise<void> {
  console.log("Thai Postal Code — data validation\n");
  const records = await loadRecords();
  checkSchema(records);
  checkPostalCodeFormat(records);
  checkNoDuplicateRows(records);
  checkPostalToDistrictInvariant(records);
  checkCoverage(records);
  checkBilingualNames(records);
  checkCoordinates(records);
  printSummary(records);
  console.log("\n✓  All checks passed\n");
}

main().catch((err: unknown) => {
  console.error("✗  validate-data failed:", err);
  process.exit(1);
});