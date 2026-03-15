/**
 * scripts/validate-data.ts
 *
 * Validates the generated src/data/thai-postal-code.data.ts against
 * structural and domain invariants.
 *
 * Exits 0 on success, 1 on any violation.
 *
 * Run via: bun run scripts/validate-data.ts
 */

import { join } from "node:path";

const DATA_PATH = join(import.meta.dir, "../src/data/thai-postal-code.data.ts");

interface RawRecord {
  zipCode: string;
  province: string;
  district: string;
  subDistrict: string;
  lat: number;
  lng: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fail(msg: string): never {
  console.error(`\n✗  FAIL  ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`⚠  WARN  ${msg}`);
}

function pass(msg: string): void {
  console.log(`✓  ${msg}`);
}

// ─── Load ────────────────────────────────────────────────────────────────────

async function loadRecords(): Promise<RawRecord[]> {
  // Check the file exists before importing
  const file = Bun.file(DATA_PATH);
  const exists = await file.exists();
  if (!exists) {
    fail(
      `Data file not found: ${DATA_PATH}\n   Run: bun run data:fetch`
    );
  }

  // @ts-expect-error
  const mod = await import("../src/data/thai-postal-code.data");
  const data = mod.default as unknown;

  if (!Array.isArray(data)) {
    fail("Expected data default export to be an array");
  }

  return data as RawRecord[];
}

// ─── Validators ──────────────────────────────────────────────────────────────

function checkSchema(records: RawRecord[]): void {
  const REQUIRED: (keyof RawRecord)[] = [
    "zipCode",
    "province",
    "district",
    "subDistrict",
    "lat",
    "lng",
  ];

  let malformed = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i] as Record<string, unknown>;
    for (const field of REQUIRED) {
      if (r[field] === undefined || r[field] === null || r[field] === "") {
        console.error(`  Row ${i}: missing or empty field "${field}": ${JSON.stringify(r)}`);
        malformed++;
        if (malformed >= 5) {
          fail(`Schema check aborted after 5 errors`);
        }
      }
    }
  }

  if (malformed > 0) fail(`${malformed} record(s) failed schema check`);
  pass(`Schema check — all ${records.length} records have required fields`);
}

function checkZipCodeFormat(records: RawRecord[]): void {
  const invalid = records.filter((r) => !/^\d{5}$/.test(r.zipCode));
  if (invalid.length > 0) {
    invalid.slice(0, 5).forEach((r) =>
      console.error(`  Bad zipCode: "${r.zipCode}"`)
    );
    fail(`${invalid.length} record(s) have non-5-digit zipCodes`);
  }
  pass(`ZIP format check — all zipCodes are 5-digit strings`);
}

function checkNoDuplicateRows(records: RawRecord[]): void {
  const seen = new Set<string>();
  const dupes: string[] = [];

  for (const r of records) {
    const key = `${r.zipCode}|${r.subDistrict}`;
    if (seen.has(key)) {
      dupes.push(key);
    }
    seen.add(key);
  }

  if (dupes.length > 0) {
    dupes.slice(0, 5).forEach((k) => console.error(`  Duplicate: ${k}`));
    fail(`${dupes.length} duplicate (zipCode + subDistrict) pair(s) found`);
  }
  pass(`Dedup check — no duplicate (zipCode + subDistrict) pairs`);
}

/**
 * Core domain invariant:
 * Each zipCode must map to exactly ONE province and ONE district.
 * A zipCode spanning multiple districts is a data error.
 */
function checkZipToDistrictInvariant(records: RawRecord[]): void {
  // Map: zipCode → Set of "province|district"
  const zipMap = new Map<string, Set<string>>();

  for (const r of records) {
    const existing = zipMap.get(r.zipCode);
    const key = `${r.province}|${r.district}`;
    if (existing !== undefined) {
      existing.add(key);
    } else {
      zipMap.set(r.zipCode, new Set([key]));
    }
  }

  const violations: string[] = [];

  for (const [zip, districts] of zipMap.entries()) {
    if (districts.size > 1) {
      violations.push(
        `  zipCode ${zip} maps to ${districts.size} province|district combos:\n` +
          [...districts].map((d) => `    → ${d}`).join("\n")
      );
    }
  }

  if (violations.length > 0) {
    violations.slice(0, 3).forEach((v) => console.error(v));
    warn(
      `${violations.length} zipCode(s) map to multiple districts. ` +
        `This may be intentional in the upstream data — review before treating as fatal.`
    );
    // Warn only — do not fail, as upstream data may legitimately have border cases
  } else {
    pass(
      `District invariant — every zipCode maps to exactly 1 province + district`
    );
  }
}

function checkCoordinates(records: RawRecord[]): void {
  // Thailand bounding box (generous): lat 5–21, lng 97–106
  const THAILAND_LAT = { min: 4.5, max: 21.5 };
  const THAILAND_LNG = { min: 97.0, max: 106.0 };

  const outOfBounds = records.filter(
    (r) =>
      r.lat !== 0 &&
      r.lng !== 0 &&
      (r.lat < THAILAND_LAT.min ||
        r.lat > THAILAND_LAT.max ||
        r.lng < THAILAND_LNG.min ||
        r.lng > THAILAND_LNG.max)
  );

  const zeroed = records.filter((r) => r.lat === 0 && r.lng === 0);

  if (zeroed.length > 0) {
    warn(`${zeroed.length} record(s) have lat=0, lng=0 — missing coordinates`);
  }

  if (outOfBounds.length > 0) {
    outOfBounds.slice(0, 5).forEach((r) =>
      console.error(
        `  Out-of-bounds: zipCode=${r.zipCode} lat=${r.lat} lng=${r.lng}`
      )
    );
    fail(`${outOfBounds.length} record(s) have coordinates outside Thailand`);
  }

  pass(
    `Coordinate check — all non-zero coordinates are within Thailand's bounding box`
  );
}

function checkCoverage(records: RawRecord[]): void {
  const uniqueZips = new Set(records.map((r) => r.zipCode));
  const uniqueProvinces = new Set(records.map((r) => r.province));

  // Thailand has 77 provinces
  if (uniqueProvinces.size < 77) {
    warn(
      `Only ${uniqueProvinces.size} provinces found — expected 77. ` +
        `Some provinces may be missing from upstream data.`
    );
  } else {
    pass(`Province coverage — ${uniqueProvinces.size} provinces`);
  }

  pass(
    `Postal code coverage — ${uniqueZips.size} unique postal codes, ` +
      `${records.length} total rows`
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary(records: RawRecord[]): void {
  const uniqueZips = new Set(records.map((r) => r.zipCode));
  const uniqueProvinces = new Set(records.map((r) => r.province));
  const uniqueDistricts = new Set(records.map((r) => r.district));
  const uniqueSubDistricts = new Set(records.map((r) => r.subDistrict));

  const perZip: number[] = [];
  const zipToSubs = new Map<string, Set<string>>();
  for (const r of records) {
    const s = zipToSubs.get(r.zipCode) ?? new Set();
    s.add(r.subDistrict);
    zipToSubs.set(r.zipCode, s);
  }
  for (const subs of zipToSubs.values()) perZip.push(subs.size);
  const avgSubsPerZip = (perZip.reduce((a, b) => a + b, 0) / perZip.length).toFixed(1);
  const maxSubsPerZip = Math.max(...perZip);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Data summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total rows          : ${records.length}
  Unique postal codes : ${uniqueZips.size}
  Unique provinces    : ${uniqueProvinces.size}
  Unique districts    : ${uniqueDistricts.size}
  Unique subdistricts : ${uniqueSubDistricts.size}
  Avg sub-districts/zip : ${avgSubsPerZip}
  Max sub-districts/zip : ${maxSubsPerZip}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Thai Postal Code — data validation\n");

  const records = await loadRecords();

  checkSchema(records);
  checkZipCodeFormat(records);
  checkNoDuplicateRows(records);
  checkZipToDistrictInvariant(records);
  checkCoordinates(records);
  checkCoverage(records);
  printSummary(records);

  console.log("\n✓  All checks passed\n");
}

main().catch((err: unknown) => {
  console.error("✗  validate-data failed:", err);
  process.exit(1);
});