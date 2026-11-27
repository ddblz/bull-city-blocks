import { describe, expect, it } from "vitest";
import { attachPagesDomain, type Cf, zoneCandidates } from "./pages-domain";

/** A fake Cloudflare API holding some Pages domains, zones and CNAMEs, recording every call. */
function fakeCloudflare(
  state: {
    pages?: string[];
    zones?: Record<string, string>;
    cnames?: string[];
    fail?: string;
  } = {},
) {
  const calls: string[] = [];
  const pages = [...(state.pages ?? [])];
  const cnames = [...(state.cnames ?? [])];
  const cf: Cf = async (method, path, body) => {
    calls.push(`${method} ${path}`);
    const ok = (result: unknown) => ({ success: true, result });
    if (state.fail && path.includes(state.fail))
      return { success: false, result: null, errors: [{ message: "Authentication error" }] };
    if (path.endsWith("/domains") && method === "GET") return ok(pages.map((name) => ({ name })));
    if (path.endsWith("/domains") && method === "POST") {
      pages.push((body as { name: string }).name);
      return ok({});
    }
    if (path.startsWith("/zones?name=")) {
      const id = state.zones?.[path.split("=")[1] as string];
      return ok(id ? [{ id }] : []);
    }
    if (path.includes("/dns_records") && method === "GET") {
      return ok(cnames.filter((n) => path.endsWith(`name=${n}`)).map((name) => ({ name })));
    }
    if (path.includes("/dns_records") && method === "POST") {
      cnames.push((body as { name: string }).name);
      return ok({});
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
  return { cf, calls, pages, cnames };
}

describe("zoneCandidates (#51)", () => {
  it("lists the hostname and its parents, longest first, never a bare TLD", () => {
    expect(zoneCandidates("play.example.com")).toEqual(["play.example.com", "example.com"]);
    expect(zoneCandidates("a.b.example.co.uk")).toEqual([
      "a.b.example.co.uk",
      "b.example.co.uk",
      "example.co.uk",
      "co.uk",
    ]);
    expect(zoneCandidates("example.com")).toEqual(["example.com"]);
  });
});

describe("attachPagesDomain (#51)", () => {
  const zones = { "example.com": "zone-1" };

  it("attaches the domain and adds the CNAME to the Pages site", async () => {
    const api = fakeCloudflare({ zones });
    const log = await attachPagesDomain(api.cf, "acct", "bull-city-blocks", "play.example.com");
    expect(log).toEqual([
      "attached play.example.com to bull-city-blocks",
      "added a CNAME from play.example.com to bull-city-blocks.pages.dev",
    ]);
    expect(api.pages).toEqual(["play.example.com"]);
    expect(api.cnames).toEqual(["play.example.com"]);
    expect(api.calls).toContain("POST /accounts/acct/pages/projects/bull-city-blocks/domains");
    expect(api.calls).toContain("GET /zones?name=example.com"); // after play.example.com wasn't a zone
  });

  it("is idempotent: a second run attaches and adds nothing", async () => {
    const api = fakeCloudflare({ zones });
    await attachPagesDomain(api.cf, "acct", "bull-city-blocks", "play.example.com");
    const before = api.calls.length;
    const log = await attachPagesDomain(api.cf, "acct", "bull-city-blocks", "play.example.com");
    expect(log).toEqual([
      "play.example.com is already attached to bull-city-blocks",
      "play.example.com already has a CNAME",
    ]);
    expect(api.calls.slice(before).some((c) => c.startsWith("POST"))).toBe(false);
  });

  it("surfaces Cloudflare's own message when a call fails, naming the step", async () => {
    const api = fakeCloudflare({ zones, fail: "/zones" });
    await expect(attachPagesDomain(api.cf, "acct", "p", "play.example.com")).rejects.toThrow(
      "find the DNS zone: Authentication error",
    );
  });

  it("explains a domain that isn't on this account", async () => {
    const api = fakeCloudflare({ zones: {} });
    await expect(attachPagesDomain(api.cf, "acct", "p", "play.example.com")).rejects.toThrow(
      /no Cloudflare zone for play.example.com/,
    );
  });
});
