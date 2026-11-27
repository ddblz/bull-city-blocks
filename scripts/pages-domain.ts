/**
 * Attaches a custom domain to a Cloudflare Pages project and points its DNS at it (#51). The
 * wrangler CLI can't do either, so this uses Cloudflare's API. Every call is idempotent, so the
 * deploy workflow can run it on every push. No I/O here: `cf` is passed in (see pages-domain.cli.mjs).
 */

export type Cf = (
  method: "GET" | "POST",
  path: string,
  body?: unknown,
) => Promise<{ success: boolean; result: unknown; errors?: { message: string }[] }>;

/** Candidate zone names for a hostname, longest first, never a bare TLD. */
export function zoneCandidates(domain: string): string[] {
  const labels = domain.split(".");
  return labels.slice(0, -1).map((_, i) => labels.slice(i).join("."));
}

async function need(what: string, call: ReturnType<Cf>): Promise<unknown> {
  const res = await call;
  if (res.success) return res.result;
  throw new Error(
    `${what}: ${res.errors?.map((e) => e.message).join("; ") || "the request failed"}`,
  );
}

/** Returns what it did, one line per step. Throws with Cloudflare's own message on failure. */
export async function attachPagesDomain(
  cf: Cf,
  account: string,
  project: string,
  domain: string,
): Promise<string[]> {
  const log: string[] = [];
  const base = `/accounts/${account}/pages/projects/${project}/domains`;
  const attached = (await need("list the Pages domains", cf("GET", base))) as { name: string }[];
  if (attached.some((d) => d.name === domain))
    log.push(`${domain} is already attached to ${project}`);
  else {
    await need(`attach ${domain} to ${project}`, cf("POST", base, { name: domain }));
    log.push(`attached ${domain} to ${project}`);
  }

  let zone: string | undefined;
  for (const name of zoneCandidates(domain)) {
    const zones = (await need("find the DNS zone", cf("GET", `/zones?name=${name}`))) as {
      id: string;
    }[];
    zone = zones[0]?.id;
    if (zone) break;
  }
  if (!zone)
    throw new Error(
      `no Cloudflare zone for ${domain}: is the domain on this account, and does the token cover its zone?`,
    );
  const records = (await need(
    "list the DNS records",
    cf("GET", `/zones/${zone}/dns_records?type=CNAME&name=${domain}`),
  )) as unknown[];
  if (records.length > 0) log.push(`${domain} already has a CNAME`);
  else {
    const record = { type: "CNAME", name: domain, content: `${project}.pages.dev`, proxied: true };
    await need(`add the CNAME for ${domain}`, cf("POST", `/zones/${zone}/dns_records`, record));
    log.push(`added a CNAME from ${domain} to ${project}.pages.dev`);
  }
  return log;
}
