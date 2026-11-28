import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import { AA, contrast } from "./contrast";
import {
  DISTRICT_COLORS,
  districtColor,
  districtText,
  FALLBACK_DISTRICT_COLOR,
} from "./district-colors";

const ids = durham.districts.map((d) => d.id);

describe("district colours (#56)", () => {
  it("has a colour for every district in content/durham.json, and none for a district that isn't there", () => {
    expect(Object.keys(DISTRICT_COLORS).sort()).toEqual([...ids].sort());
  });

  it("gives every district its own colour", () => {
    expect(new Set(Object.values(DISTRICT_COLORS)).size).toBe(ids.length);
  });

  it.each(ids)("%s reaches 4.5:1 with its text colour", (id) => {
    expect(contrast(districtColor(id), districtText(id))).toBeGreaterThanOrEqual(AA);
  });

  it("falls back to a neutral that reads with white text for an unknown district", () => {
    expect(districtColor("not-a-district")).toBe(FALLBACK_DISTRICT_COLOR);
    expect(
      contrast(FALLBACK_DISTRICT_COLOR, districtText("not-a-district")),
    ).toBeGreaterThanOrEqual(AA);
  });
});
