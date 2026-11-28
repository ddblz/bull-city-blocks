import { INK, textOn, WHITE } from "./contrast";

/**
 * One colour per district (`content/durham.json` ids), from the 14-district palette in
 * docs/design/stitch/bull_city_blocks/DESIGN.md. A district's colour is the same in light and dark
 * mode; `districtText` picks white or ink text for it. Every pair reaches 4.5:1 (district-colors.test.ts).
 *
 * Two of the design's colours missed 4.5:1 with both white and ink text, so they were nudged the
 * least that fixes it: The Eno #0284C7 → #028CD4 (ink text) and Downtown #6366F1 → #5E61F1 (white).
 */
export const DISTRICT_COLORS: Readonly<Record<string, string>> = {
  "old-west-durham": "#D97706",
  walltown: "#3B82F6",
  "east-durham": "#15803D",
  hayti: "#7E22CE",
  "north-durham": "#0D9488",
  "the-eno": "#028CD4",
  "trinity-park": "#BE123C",
  "forest-hills": "#047857",
  brightleaf: "#CA8A04",
  "american-tobacco": "#B45309",
  downtown: "#5E61F1",
  duke: "#1E3A8A",
  rtp: "#0891B2",
  transit: "#EA580C",
};

/** For a district id this table doesn't know (a content edit): a neutral that reads with white text. */
export const FALLBACK_DISTRICT_COLOR = "#57534E";

export const districtColor = (id: string): string => DISTRICT_COLORS[id] ?? FALLBACK_DISTRICT_COLOR;

/** White or ink text, whichever reads better on the district's colour. */
export const districtText = (id: string): string => textOn(districtColor(id));

export { INK, WHITE };
