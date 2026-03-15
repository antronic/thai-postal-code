/**
 * scripts/bundle-data.ts
 *
 * Downloads the upstream data.json from rathpanyowat/Thai-zip-code-latitude-and-longitude
 * and writes a typed TypeScript data module to src/data/thai-postal-code.data.ts.
 *
 * Run via: bun run scripts/bundle-data.ts
 */

import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const DATA_URL =
  "https://raw.githubusercontent.com/rathpanyowat/Thai-zip-code-latitude-and-longitude/master/data.json";

const OUTPUT_PATH = join(import.meta.dir, "../src/data/thai-postal-code.data.ts");

interface RawRecord {
  zipCode: string;
  province: string;
  district: string;
  subDistrict: string;
  lat: number;
  lng: number;
}

async function main(): Promise<void> {
  console.log(`⬇  Fetching data from:\n   ${DATA_URL}\n`);

  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
  }

  const raw: unknown = await response.json();

  if (!Array.isArray(raw)) {
    throw new Error("Expected an array at the top level of data.json");
  }

  // Validate and clean
  const records: RawRecord[] = raw.map((item: unknown, i: number) => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("zipCode" in item) ||
      !("province" in item) ||
      !("district" in item) ||
      !("subDistrict" in item)
    ) {
      throw new Error(`Invalid record at index ${i}: ${JSON.stringify(item)}`);
    }

    const r = item as Record<string, unknown>;

    return {
      zipCode: String(r["zipCode"]).trim(),
      province: String(r["province"]).trim(),
      district: String(r["district"]).trim(),
      subDistrict: String(r["subDistrict"]).trim(),
      lat: Number(r["lat"] ?? 0),
      lng: Number(r["lng"] ?? 0),
    };
  });

  // Deduplicate by composite key
  const seen = new Set<string>();
  const deduped = records.filter((r) => {
    const key = `${r.zipCode}|${r.subDistrict}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`✓  Loaded ${records.length} records (${deduped.length} after dedup)`);

  const output = `// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Source: https://github.com/rathpanyowat/Thai-zip-code-latitude-and-longitude
// Generated at: ${new Date().toISOString()}

import type { RawThaiRecord } from "../types/index";

const data: RawThaiRecord[] = ${JSON.stringify(deduped, null, 2)};

export default data;
`;

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await Bun.write(OUTPUT_PATH, output);

  console.log(`✓  Written to: ${OUTPUT_PATH}`);
  console.log(`\nTotal unique postal codes: ${new Set(deduped.map((r) => r.zipCode)).size}`);
}

main().catch((err: unknown) => {
  console.error("✗  bundle-data failed:", err);
  process.exit(1);
});