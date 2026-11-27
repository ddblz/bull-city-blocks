// Deploy workflow step: attaches PAGES_DOMAIN to the Pages project PROJECT and points its DNS at it.
// Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Usage: node scripts/pages-domain.cli.mjs
import { attachPagesDomain } from "./pages-domain.ts";

const {
  CLOUDFLARE_API_TOKEN: token,
  CLOUDFLARE_ACCOUNT_ID: account,
  PAGES_DOMAIN: domain,
  PROJECT: project,
} = process.env;
const cf = async (method, path, body) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return res.json();
};
try {
  for (const line of await attachPagesDomain(cf, account, project, domain)) console.log(line);
} catch (error) {
  console.log(`::error::${error.message}`);
  process.exit(1);
}
