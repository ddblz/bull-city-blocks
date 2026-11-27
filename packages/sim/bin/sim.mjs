// pnpm sim --ruleset <id> --players 2-10 --games N --bots greedy,random [--out path]
//          [--workers k] [--max-stall-rate 0.2] [--i-mean-it]
// Runs N games per player count in worker threads, prints SPEC §6 metrics and writes JSON.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { BOTS, computeMetrics, formatMetrics } from "../src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const fail = (message) => {
  console.error(`sim: ${message}`);
  process.exit(1);
};

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith("--")) args[key] = true;
  else args[key] = process.argv[++i];
}
const ruleset = args.ruleset ?? "base";
const games = Number(args.games ?? 1000);
const bots = String(args.bots ?? "greedy,random").split(",");
const range = String(args.players ?? "2-10")
  .split(",")
  .flatMap((part) => {
    const [a, b = a] = part.split("-").map(Number);
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });
const workers = Number(args.workers ?? Math.max(1, availableParallelism() - 1));
const out = args.out ?? join("reports", `sim-${ruleset}.json`);

if (!Number.isInteger(games) || games < 1) fail("--games must be a positive integer");
if (games > 50_000 && !args["i-mean-it"])
  fail(`refusing to run ${games} games without --i-mean-it`);
if (range.some((n) => !Number.isInteger(n) || n < 2 || n > 10))
  fail("--players must be within 2-10");
for (const bot of bots)
  if (!BOTS[bot]) fail(`unknown bot "${bot}" (known: ${Object.keys(BOTS).join(", ")})`);

const rulesetFiles = readdirSync(join(root, "rulesets"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(root, "rulesets", f), "utf8")));
const content = JSON.parse(readFileSync(join(root, "content", "durham.json"), "utf8"));

const runBatch = (spec) =>
  new Promise((done, reject) => {
    const worker = new Worker(new URL("./worker.mjs", import.meta.url), { workerData: spec });
    worker.once("message", done);
    worker.once("error", reject);
  });

const report = { ruleset, games, bots, players: [] };
for (const players of range) {
  const chunk = Math.ceil(games / workers);
  const batches = [];
  for (let from = 0; from < games; from += chunk) {
    batches.push(
      runBatch({
        rulesetFiles,
        ruleset,
        content,
        players,
        bots,
        from,
        to: Math.min(games, from + chunk),
      }),
    );
  }
  const summaries = (
    await Promise.all(batches).catch((e) => fail(`engine error: ${e.message}`))
  ).flat();
  const metrics = computeMetrics(players, summaries);
  console.log(`${formatMetrics(metrics)}\n`);
  report.players.push(metrics);
}

const outPath = resolve(root, out);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${out}`);

const maxStall = args["max-stall-rate"] === undefined ? null : Number(args["max-stall-rate"]);
const stalled = report.players.filter((m) => maxStall !== null && m.stallRate.value > maxStall);
if (stalled.length)
  fail(`stall rate above ${maxStall} at ${stalled.map((m) => `${m.players}p`).join(", ")}`);
