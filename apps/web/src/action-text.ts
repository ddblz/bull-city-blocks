import type { ACTIONS } from "@bull-city-blocks/engine";
import type { View } from "./types";

export type ActionId = (typeof ACTIONS)[number];

/**
 * A short effect line for each action card (#57), written from SPEC §4.5. The content files carry
 * no rules text, so it lives here. Numbers that a ruleset can change (the Rodeo's target cap, the
 * Assessment cap, the Takeover's cost, whether a Buyout pays) come from the room's rules, so a
 * variant's cards read correctly.
 */
export function actionText(action: ActionId, rules: View["rules"]): string {
  const { foodTruckRodeo, assessment, buyout, hostileTakeover } = rules.actions;
  switch (action) {
    case "walkOffWin":
      return "Draw 2 cards.";
    case "foodTruckRodeo": {
      const cap =
        foodTruckRodeo.maxTargets === null
          ? ""
          : ` At most ${foodTruckRodeo.maxTargets} players pay.`;
      return `Every other player pays you $2.${cap}`;
    }
    case "assessment":
      return `One player pays you $1 for each property they own, up to $${assessment.cap}.`;
    case "buyout":
      return `Take a property from a player's incomplete set.${buyout.payCardValue ? " You pay them its value." : ""}`;
    case "swapMeet":
      return "Swap one of your properties with another player's. Both come from incomplete sets.";
    case "hostileTakeover":
      return `Take a complete district and its upgrades from one player. Costs ${hostileTakeover.playCost} plays.`;
    case "appeal":
      return "Cancel an action aimed at you. It can be Appealed back.";
    case "constructionDelay":
      return "The target draws only 1 card on their next turn.";
    case "rentHike":
      return "Play with a rent card to double that rent. Uses a play.";
  }
}
