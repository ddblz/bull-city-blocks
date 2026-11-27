// Manual smoke test for #36 (not run in CI). Start `pnpm play` and `pnpm dev:web`, then:
//   node apps/web/e2e/smoke.mjs [http://localhost:5173] [screenshot-dir]
// Two players in separate browser contexts (like two devices) create and join a room by link.
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const web = process.argv[2] ?? "http://localhost:5173";
const shots = process.argv[3];
const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`ok - ${what}`);
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 } };
const ana = await (await browser.newContext(phone)).newPage();
const ben = await (await browser.newContext(phone)).newPage();
try {
  await ana.goto(web);
  await ana.getByRole("button", { name: "Create a room" }).click();
  await ana.waitForURL(/#\/room\//);
  await ana.getByLabel("Your name").fill("Ana");
  await ana.getByRole("button", { name: "Join" }).click();
  await ana.getByText("Seats (1/10)").waitFor();
  const link = ana.url();
  check(true, `host created a room and joined: ${link}`);

  await ben.goto(link);
  await ben.getByLabel("Your name").fill("Ben");
  await ben.getByRole("button", { name: "Join" }).click();
  await ben.getByText("Seats (2/10)").waitFor();
  await ana.getByText("Seats (2/10)").waitFor();
  check(true, "a second player joined by link, and both see two seats");

  check(await ana.getByRole("button", { name: "Start game" }).isVisible(), "the host sees the settings");
  check((await ben.getByRole("button", { name: "Start game" }).count()) === 0, "the other player doesn't");

  await ana.getByRole("button", { name: "Add greedy bot" }).click();
  await ben.getByText("Seats (3/10)").waitFor();
  check(true, "a bot added by the host shows up for everyone");

  await ben.reload();
  await ben.getByText("Seats (3/10)").waitFor();
  const benSeat = await ben.locator(".seats li", { hasText: "Ben" }).innerText();
  check(benSeat.includes("you"), "reloading reconnects to the same seat");

  if (shots) {
    await ana.screenshot({ path: `${shots}/host-lobby.png`, fullPage: true });
    await ben.screenshot({ path: `${shots}/guest-lobby.png`, fullPage: true });
  }
  await ana.getByRole("button", { name: "Start game" }).click();
  await ben.getByText("The game has started.").waitFor();
  check(true, "the host started the game and the other player saw it");
} finally {
  await browser.close();
}
