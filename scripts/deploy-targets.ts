/** Pure logic for the deploy workflow's custom domains (#51). No I/O here; see deploy-targets.cli.mjs. */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DeployTargets {
  /** Extra arguments for `wrangler deploy`. */
  workerArgs: string[];
  /** The game server's URL for the web build, or null to use the workers.dev URL. */
  apiUrl: string | null;
  /** The Pages custom domain, or null. */
  pagesDomain: string | null;
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** A trimmed, lowercase hostname, or what's wrong with it. Nothing else reaches a shell. */
export function parseDomain(name: string, raw: string): Result<string> {
  const host = raw.trim().toLowerCase();
  const labels = host.split(".");
  if (host.length > 253 || labels.length < 2 || !labels.every((l) => LABEL.test(l)))
    return {
      ok: false,
      error: `${name} must be a plain hostname like play.example.com (got "${raw}")`,
    };
  return { ok: true, value: host };
}

/** What to deploy where, from the repo variables WEB_DOMAIN and API_DOMAIN: both, or neither. */
export function deployTargets(env: {
  WEB_DOMAIN?: string | undefined;
  API_DOMAIN?: string | undefined;
}): Result<DeployTargets> {
  const [web, api] = [env.WEB_DOMAIN?.trim() ?? "", env.API_DOMAIN?.trim() ?? ""];
  if (!web && !api) return { ok: true, value: { workerArgs: [], apiUrl: null, pagesDomain: null } };
  if (!web || !api)
    return {
      ok: false,
      error: `set both WEB_DOMAIN and API_DOMAIN, or neither (${web ? "API_DOMAIN" : "WEB_DOMAIN"} is missing)`,
    };
  const [webHost, apiHost] = [parseDomain("WEB_DOMAIN", web), parseDomain("API_DOMAIN", api)];
  if (!webHost.ok) return webHost;
  if (!apiHost.ok) return apiHost;
  if (webHost.value === apiHost.value)
    return { ok: false, error: "WEB_DOMAIN and API_DOMAIN must be different hostnames" };
  return {
    ok: true,
    value: {
      workerArgs: ["--domain", apiHost.value],
      apiUrl: `https://${apiHost.value}`,
      pagesDomain: webHost.value,
    },
  };
}
