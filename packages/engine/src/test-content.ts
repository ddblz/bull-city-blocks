import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { type Content, parseContent } from "./content";
import { loadRuleset, type RuleSet } from "./ruleset";

/** The validated Durham content. */
export function durhamContent(): Content {
  const parsed = parseContent(durham);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** The loaded base ruleset, for tests. */
export function baseRules(): RuleSet {
  const loaded = loadRuleset("base", [base]);
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.value;
}

export { base as baseJson, durham as durhamJson };
