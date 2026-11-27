// Deploy workflow step: validates the repo variables WEB_DOMAIN and API_DOMAIN and writes the
// results as `key=value` lines to $GITHUB_OUTPUT (or prints them). Usage: node scripts/deploy-targets.cli.mjs
import { appendFileSync } from "node:fs";
import { deployTargets } from "./deploy-targets.ts";

const result = deployTargets({
  WEB_DOMAIN: process.env.WEB_DOMAIN,
  API_DOMAIN: process.env.API_DOMAIN,
});
if (!result.ok) {
  console.log(`::error::${result.error}`);
  process.exit(1);
}
const { workerArgs, apiUrl, pagesDomain } = result.value;
const lines = `worker_args=${workerArgs.join(" ")}\napi_url=${apiUrl ?? ""}\npages_domain=${pagesDomain ?? ""}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
else process.stdout.write(lines);
