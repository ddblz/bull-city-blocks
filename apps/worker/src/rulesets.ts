import base from "../../../rulesets/base.json" with { type: "json" };
import rodeoCap4 from "../../../rulesets/rodeo-cap-4.json" with { type: "json" };

/**
 * Every committed ruleset, bundled into the Worker (it can't list a directory at run time).
 * do.test.ts fails if a file in rulesets/ is missing here.
 */
export const RULESETS: readonly unknown[] = [base, rodeoCap4];
