import { describe, it, expect } from "bun:test";
import {
  lookupByPostalCode,
  autofillByPostalCode,
  getSubdistrictsByPostalCode,
  listProvinces,
  listDistrictsByProvince,
  searchAddress,
  listAllPostalCodes,
} from "../src/index";

// Note: _clearCache is a no-op in the sync loader design.
// All tests use the module-level indexes built at import time.

// ─── lookupByPostalCode ───────────────────────────────────────────────────────

describe("lookupByPostalCode", () => {
  it("returns Thai and English province + district names", () => {
    const result = lookupByPostalCode("10330");
    expect(result).not.toBeNull();
    expect(result?.provinceNameTh.length).toBeGreaterThan(0);
    expect(result?.provinceNameEn.length).toBeGreaterThan(0);
    expect(result?.districtNameTh.length).toBeGreaterThan(0);
    expect(result?.districtNameEn.length).toBeGreaterThan(0);
  });

  it("returns correct postalCode on the result", () => {
    const result = lookupByPostalCode("10330");
    expect(result?.postalCode).toBe("10330");
  });

  it("returns non-empty subdistricts array with bilingual names", () => {
    const result = lookupByPostalCode("10330");
    expect(result!.subdistricts.length).toBeGreaterThan(0);
    const first = result!.subdistricts[0]!;
    expect(typeof first.subdistrictNameTh).toBe("string");
    expect(typeof first.subdistrictNameEn).toBe("string");
    expect(typeof first.subdistrictCode).toBe("number");
  });

  it("subdistricts are sorted by Thai name", () => {
    const result = lookupByPostalCode("10330");
    const names = result!.subdistricts.map((s) => s.subdistrictNameTh);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "th")));
  });

  it("includes lat and lng (number or null)", () => {
    const result = lookupByPostalCode("10330");
    // lat/lng are number | null — both are valid depending on coverage
    const lat = result?.lat;
    const lng = result?.lng;
    expect(lat === null || typeof lat === "number").toBe(true);
    expect(lng === null || typeof lng === "number").toBe(true);
    // 10330 is a well-known BKK code — should have coordinates
    if (lat !== null) {
      expect(lat).toBeGreaterThan(4.5);
      expect(lat).toBeLessThan(21.5);
    }
    if (lng !== null) {
      expect(lng).toBeGreaterThan(97);
      expect(lng).toBeLessThan(106);
    }
  });

  it("throws for unknown postal code by default", () => {
    expect(() => lookupByPostalCode("00000")).toThrow("[thai-postal-code]");
  });

  it("returns null for unknown code when silent: true", () => {
    expect(lookupByPostalCode("00000", { silent: true })).toBeNull();
  });

  it("throws for non-5-digit input", () => {
    expect(() => lookupByPostalCode("1234")).toThrow();
    expect(() => lookupByPostalCode("123456")).toThrow();
  });

  it("returns null for non-numeric input when silent: true", () => {
    expect(lookupByPostalCode("abcde", { silent: true })).toBeNull();
  });

  it("trims whitespace from input", () => {
    const result = lookupByPostalCode("  10330  ", { silent: true });
    expect(result?.postalCode).toBe("10330");
  });

  it("is synchronous — returns a value, not a Promise", () => {
    const result = lookupByPostalCode("10330");
    expect(result).not.toBeInstanceOf(Promise);
    expect(result?.postalCode).toBe("10330");
  });
});

// ─── autofillByPostalCode ────────────────────────────────────────────────────

describe("autofillByPostalCode", () => {
  it("returns all autofill fields without lat/lng", () => {
    const result = autofillByPostalCode("50000");
    expect(result).not.toBeNull();
    expect(result?.provinceNameTh).toBeDefined();
    expect(result?.provinceNameEn).toBeDefined();
    expect(result?.districtNameTh).toBeDefined();
    expect(result?.districtNameEn).toBeDefined();
    expect(Array.isArray(result?.subdistricts)).toBe(true);
    expect(result).not.toHaveProperty("lat");
    expect(result).not.toHaveProperty("lng");
  });

  it("is synchronous", () => {
    const result = autofillByPostalCode("10330");
    expect(result).not.toBeInstanceOf(Promise);
  });

  it("returns null for unknown code when silent", () => {
    expect(autofillByPostalCode("00000", { silent: true })).toBeNull();
  });
});

// ─── getSubdistrictsByPostalCode ─────────────────────────────────────────────

describe("getSubdistrictsByPostalCode", () => {
  it("returns SubdistrictEntry array with bilingual names", () => {
    const subs = getSubdistrictsByPostalCode("10330");
    expect(subs.length).toBeGreaterThan(0);
    subs.forEach((s) => {
      expect(typeof s.subdistrictNameTh).toBe("string");
      expect(typeof s.subdistrictNameEn).toBe("string");
      expect(typeof s.subdistrictCode).toBe("number");
    });
  });

  it("returns empty array for unknown postal code", () => {
    expect(getSubdistrictsByPostalCode("00000")).toEqual([]);
  });
});

// ─── listProvinces ───────────────────────────────────────────────────────────

describe("listProvinces", () => {
  it("returns all 77 provinces", () => {
    expect(listProvinces().length).toBe(77);
  });

  it("each entry has nameTh and nameEn", () => {
    listProvinces().forEach((p) => {
      expect(typeof p.nameTh).toBe("string");
      expect(typeof p.nameEn).toBe("string");
    });
  });

  it("contains Bangkok", () => {
    const bkk = listProvinces().find((p) => p.nameTh === "กรุงเทพมหานคร");
    expect(bkk?.nameEn).toBe("Bangkok");
  });

  it("is sorted by Thai name", () => {
    const names = listProvinces().map((p) => p.nameTh);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "th")));
  });
});

// ─── listDistrictsByProvince ─────────────────────────────────────────────────

describe("listDistrictsByProvince", () => {
  it("returns districts with nameTh, nameEn, postalCode", () => {
    const districts = listDistrictsByProvince("เชียงใหม่");
    expect(districts.length).toBeGreaterThan(0);
    districts.forEach((d) => {
      expect(typeof d.nameTh).toBe("string");
      expect(typeof d.nameEn).toBe("string");
      expect(d.postalCode).toMatch(/^\d{5}$/);
    });
  });

  it("returns empty array for unknown province", () => {
    expect(listDistrictsByProvince("ไม่มีจังหวัดนี้")).toEqual([]);
  });
});

// ─── searchAddress ───────────────────────────────────────────────────────────

describe("searchAddress", () => {
  it("finds results by Thai subdistrict name", () => {
    const results = searchAddress("สีลม");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.subdistrictNameTh).toContain("สีลม");
  });

  it("finds results by English name (case-insensitive)", () => {
    const upper = searchAddress("SI LOM");
    const lower = searchAddress("si lom");
    expect(upper.length).toBeGreaterThan(0);
    expect(upper.length).toBe(lower.length);
  });

  it("finds results by postal code", () => {
    const results = searchAddress("10500");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.postalCode === "10500")).toBe(true);
  });

  it("each result includes lat/lng (number | null)", () => {
    searchAddress("10500").forEach((r) => {
      expect(r.lat === null || typeof r.lat === "number").toBe(true);
      expect(r.lng === null || typeof r.lng === "number").toBe(true);
    });
  });

  it("respects the limit parameter", () => {
    expect(searchAddress("กรุง", 5).length).toBeLessThanOrEqual(5);
  });

  it("returns empty array for empty query", () => {
    expect(searchAddress("")).toEqual([]);
  });

  it("is synchronous", () => {
    const result = searchAddress("10330");
    expect(result).not.toBeInstanceOf(Promise);
  });
});

// ─── listAllPostalCodes ───────────────────────────────────────────────────────

describe("listAllPostalCodes", () => {
  it("returns a non-empty sorted array of 5-digit strings", () => {
    const codes = listAllPostalCodes();
    expect(codes.length).toBeGreaterThan(0);
    codes.forEach((c) => expect(c).toMatch(/^\d{5}$/));
    expect(codes).toEqual([...codes].sort());
  });
});
