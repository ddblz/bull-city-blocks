import durham from "../../../content/durham.json" with { type: "json" };
import { type Content, parseContent } from "./content";

/** The validated Durham content, for tests. */
export function durhamContent(): Content {
  const parsed = parseContent(durham);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

export { durham as durhamJson };
