// `pnpm play`: the local game server. Friends join through a room link on the same network.
import { readdirSync, readFileSync } from "node:fs";
import { startServer } from "./server";

const root = new URL("../../../", import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const rulesets = readdirSync(new URL("rulesets/", root))
  .filter((f) => f.endsWith(".json"))
  .map((f) => json(`rulesets/${f}`));

const { port } = await startServer({
  rulesets,
  content: json("content/durham.json"),
  port: Number(process.env.PORT ?? 8787),
});
console.log(
  `Bull City Blocks server: http://localhost:${port}  (POST /rooms, then WebSocket /rooms/<id>)`,
);
