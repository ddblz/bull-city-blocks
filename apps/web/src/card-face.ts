import { type ActionId, actionText } from "./action-text";
import { districtName } from "./card";
import type { IconName } from "./card-icons";
import { districtColor, districtText } from "./district-colors";
import type { Card, View } from "./types";

/** What a card's face shows (#57), worked out from the card and the room's data. Pure; CardFace.tsx draws it. */

type FaceView = Pick<View, "districts" | "rules">;

/** One coloured part of the header band: a district's name on its colour. */
export interface BandPart {
  text: string;
  background: string;
  color: string;
}

export interface FaceModel {
  kind: Card["kind"];
  /** The kind as a word, for the corner of the card. */
  tag: string;
  name: string;
  /** "$3". Cash shows it large instead of as a badge. */
  value: string;
  icon: IconName;
  /** District-coloured parts of the band; empty when the kind's own colours are used. */
  band: BandPart[];
  /** The band's words when it has no district colour ("Landmark", "Any district"). */
  bandText: string;
  /** The ladder or effect lines under the name. */
  lines: string[];
  /** Read aloud: the name, kind, value and the lines. */
  description: string;
}

const TAGS: Record<Card["kind"], string> = {
  property: "Property",
  wild: "Wild",
  landmark: "Landmark",
  icon: "Icon",
  cash: "Cash",
  action: "Action",
  rent: "Rent",
};

const part = (id: string, view: FaceView): BandPart => ({
  text: districtName(id, view),
  background: districtColor(id),
  color: districtText(id),
});

/** "1: $1 · 2: $2 · Full: $3" from a district's rent ladder. */
export const ladderText = (rent: readonly number[]) =>
  rent.map((r, i) => `${i === rent.length - 1 ? "Full" : i + 1}: $${r}`).join(" · ");

type Draft = Omit<FaceModel, "description">;

function describe(m: Draft): FaceModel {
  const where = m.band.length ? ` for ${m.band.map((b) => b.text).join(" or ")}` : "";
  return { ...m, description: [m.name, `${m.tag}${where}`, m.value, ...m.lines].join(". ") };
}

export function faceModel(card: Card, view: FaceView): FaceModel {
  const { upgrades, rent } = view.rules;
  const base = { kind: card.kind, tag: TAGS[card.kind], name: card.name, value: `$${card.value}` };
  const plain = { band: [], bandText: "" };
  const pair = (ds: readonly string[]) => ds.map((d) => districtName(d, view)).join(" or ");
  switch (card.kind) {
    case "property": {
      const ladder = view.districts[card.district]?.rent ?? [];
      return describe({
        ...base,
        icon: "property",
        band: [part(card.district, view)],
        bandText: "",
        lines: ladder.length ? [ladderText(ladder)] : [],
      });
    }
    case "wild":
      return card.districts === "any"
        ? describe({
            ...base,
            icon: "wild",
            band: [],
            bandText: "Any district",
            lines: ["Counts as any district.", "Can't pay a debt."],
          })
        : describe({
            ...base,
            icon: "wild",
            band: card.districts.map((d) => part(d, view)),
            bandText: "",
            lines: [`Counts toward ${pair(card.districts)}.`],
          });
    case "landmark":
      return describe({
        ...base,
        ...plain,
        icon: "landmark",
        bandText: "Landmark",
        lines: [`+$${upgrades.landmarkBonus} rent on a complete district.`],
      });
    case "icon":
      return describe({
        ...base,
        ...plain,
        icon: "icon",
        bandText: "Icon",
        lines: [`+$${upgrades.iconBonus} rent on a complete district with a Landmark.`],
      });
    case "cash":
      return describe({ ...base, ...plain, icon: "cash", bandText: "Cash", lines: [] });
    case "action":
      return describe({
        ...base,
        ...plain,
        icon: card.action as ActionId,
        bandText: "Action",
        lines: [actionText(card.action as ActionId, view.rules)],
      });
    case "rent": {
      const cap =
        rent.pair.maxTargets === null ? "" : ` At most ${rent.pair.maxTargets} players pay.`;
      return card.districts === "any"
        ? describe({
            ...base,
            icon: "rent",
            band: [],
            bandText: "Any district",
            lines: ["One player of your choice pays rent on any one of your districts."],
          })
        : describe({
            ...base,
            icon: "rent",
            band: card.districts.map((d) => part(d, view)),
            bandText: "",
            lines: [
              `Every other player pays rent on one of your ${pair(card.districts)} districts.${cap}`,
            ],
          });
    }
  }
}
