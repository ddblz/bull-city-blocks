// Measuring script for the phone UX study (#75, not run in CI). Start `pnpm play` and `pnpm dev:web`, then:
//   node apps/web/e2e/phone-study.mjs [http://localhost:5173] [screenshot-dir]
// Plays games with 2, 6 and 10 seats in portrait and landscape phones and prints, for each, how many
// screens tall the table is, where its parts sit, and the taps and scrolls a turn takes.
// GAME_MS caps a game's time; ORIENTATION=portrait|landscape, PHONE=<name, e.g. 740x360>, SEATS=2,6,10 and TURNS=<n> narrow or shorten the run.
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const web = process.argv[2] ?? "http://localhost:5173";
const shots = process.argv[3];
const PHONES = [
  { name: "390x844", width: 390, height: 844 },
  { name: "360x740", width: 360, height: 740 },
  { name: "844x390", width: 844, height: 390 },
  { name: "740x360", width: 740, height: 360 },
].filter(
  (p) =>
    (!process.env.PHONE || p.name === process.env.PHONE) &&
    (!process.env.ORIENTATION || p.width > p.height === (process.env.ORIENTATION === "landscape")),
);
const SEATS = (process.env.SEATS ?? "2,6,10").split(",").map(Number);
const TURNS = Number(process.env.TURNS ?? 12);
/** A game that has not reached TURNS by then is measured as it stands. */
const GAME_MS = Number(process.env.GAME_MS ?? 240000);

/** Where the parts of the table sit: the document's height in screens, and the screen each part starts on. */
const PARTS = {
  header: ".table-bar",
  opponents: ".strip, .trays",
  districts: "#districts-h",
  bank: "#bank-h",
  hand: ".hand-fan",
  actions: ".hand-actions",
  nav: ".table-nav",
};
const measure = (page) =>
  page.evaluate((parts) => {
    const h = innerHeight;
    const out = { screens: +(document.documentElement.scrollHeight / h).toFixed(1), parts: {} };
    let pinned = 0;
    const counted = new Set();
    const pinnedAncestor = (el) => {
      for (let e = el; e; e = e.parentElement)
        if (["fixed", "sticky"].includes(getComputedStyle(e).position)) return e;
      return null;
    };
    for (const [name, sel] of Object.entries(parts)) {
      const el = [...document.querySelectorAll(sel)].find(
        (e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed",
      );
      if (!el) continue;
      const fixed = pinnedAncestor(el);
      const top = el.getBoundingClientRect().top + scrollY;
      if (fixed && !counted.has(fixed)) {
        counted.add(fixed);
        pinned += fixed.getBoundingClientRect().height;
      }
      out.parts[name] = fixed ? "pinned" : `screen ${Math.floor(top / h) + 1}`;
    }
    out.pinnedPx = Math.round(pinned);
    out.freePct = Math.round(100 * (1 - pinned / h));
    return out;
  }, PARTS);

async function start(browser, phone, bots) {
  const context = await browser.newContext({
    viewport: { width: phone.width, height: phone.height },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(web);
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "Join" }).click();
  await page.locator(".editor").waitFor();
  for (let i = 0; i < bots; i++)
    await page.getByRole("button", { name: `Add ${i % 2 ? "random" : "greedy"} bot` }).click();
  await page.getByText(`Seats (${bots + 1}/10)`).waitFor();
  await page.getByRole("button", { name: "Start game" }).click();
  await page.locator(".table").waitFor();
  return page;
}

/** Plays one of my turns by tapping, counting the taps and the scrolls that were needed to reach each target. */
async function playTurn(page, count) {
  const tap = async (locator, options = {}) => {
    const box = await locator.boundingBox();
    const pinned = await locator.evaluate((el) => {
      for (let e = el; e; e = e.parentElement)
        if (["fixed", "sticky"].includes(getComputedStyle(e).position)) return true;
      return false;
    });
    const view = await page.evaluate(() => {
      const top = document.querySelector(".table-bar")?.getBoundingClientRect().bottom ?? 0;
      const bottom = Math.min(
        ...[".hand-actions", ".table-nav"].map(
          (s) => document.querySelector(s)?.getBoundingClientRect().top ?? innerHeight,
        ),
        innerHeight,
      );
      return { top, bottom };
    });
    if (!pinned && box && (box.y < view.top || box.y + box.height > view.bottom)) count.scrolls++;
    count.taps++;
    await locator.click({ timeout: 4000, ...options });
  };
  const cards = page.locator(".hand-fan .card-select");
  const actions = page.locator(".hand-actions button");
  for (let plays = 0; plays < 3; plays++) {
    let moved = false;
    for (let i = 0; i < (await cards.count()) && !moved; i++) {
      await tap(cards.nth(i), { position: { x: 16, y: 30 } });
      const names = await actions.allTextContents();
      const pick = names.findIndex((n) => n !== "Discard" && n !== "End turn");
      if (pick >= 0) {
        await tap(actions.nth(pick));
        const chooser = page.locator("dialog[open] .chooser");
        for (let k = 0; k < 4 && (await chooser.count()); k++)
          await tap(chooser.getByRole("button").first());
        moved = true;
      }
    }
    if (!moved) break;
    await page.waitForTimeout(150);
  }
  const end = page.getByRole("button", { name: "End turn" });
  if (await end.count()) await tap(end);
}

/** Answers whatever the game is waiting on; returns "pay" or "respond" the first time a dialog is measured. */
async function answerDialog(page, seen) {
  const dialog = page.locator("dialog[open]");
  if (!(await dialog.count())) return false;
  const kind = (await dialog.getByText("You owe").count())
    ? "pay"
    : (await dialog.getByRole("button", { name: "Accept" }).count())
      ? "respond"
      : null;
  if (kind && !seen[kind])
    seen[kind] = await page.evaluate(() => {
      const d = document.querySelector("dialog[open]");
      return {
        dialogPx: Math.round(d.getBoundingClientRect().height),
        screenPx: innerHeight,
        scrolls: d.scrollHeight > d.clientHeight,
      };
    });
  if (kind === "pay") {
    for (const box of await dialog.getByRole("checkbox").all()) {
      if (await dialog.getByRole("button", { name: /^Pay/ }).isEnabled()) break;
      await box.check();
    }
    await dialog.getByRole("button", { name: /^Pay/ }).click();
  } else if (kind === "respond") await dialog.getByRole("button", { name: "Accept" }).click();
  else
    await dialog
      .getByRole("button", { name: /Close|Cancel/ })
      .first()
      .click();
  return true;
}

const rows = [];
const browser = await chromium.launch();
try {
  for (const phone of PHONES)
    for (const seats of SEATS) {
      const page = await start(browser, phone, seats - 1);
      const mine = async () =>
        (
          (await page
            .locator(".status-line")
            .textContent({ timeout: 1000 })
            .catch(() => "")) ?? ""
        ).startsWith("You");
      const count = { taps: 0, scrolls: 0, turns: 0 };
      const seen = {};
      let first = null;
      let mid = null;
      const began = Date.now();
      for (let i = 0; i < 4000 && count.turns < TURNS && Date.now() - began < GAME_MS; i++) {
        if (await answerDialog(page, seen).catch(() => true)) continue;
        if (await mine()) {
          if (!first) first = await measure(page);
          await playTurn(page, count).catch(() => {});
          count.turns++;
          if (count.turns === TURNS - 1) mid = await measure(page);
        } else await page.waitForTimeout(150);
      }
      mid ??= await measure(page);
      if (shots && [6, 10].includes(seats))
        await page.screenshot({ path: `${shots}/${phone.name}-${seats}p-mid.png`, fullPage: true });
      rows.push({
        phone: phone.name,
        seats,
        first,
        mid,
        perTurn: {
          taps: +(count.taps / Math.max(1, count.turns)).toFixed(1),
          scrolls: +(count.scrolls / Math.max(1, count.turns)).toFixed(1),
        },
        dialogs: seen,
      });
      console.log(JSON.stringify(rows.at(-1)));
      await page.context().close();
    }
} finally {
  await browser.close();
}
console.log(
  "\n| phone | seats | screens (turn 1) | screens (mid) | pinned chrome | taps/turn | scrolls/turn |\n|---|---|---|---|---|---|---|",
);
for (const r of rows)
  console.log(
    `| ${r.phone} | ${r.seats} | ${r.first?.screens} | ${r.mid?.screens} | ${r.mid?.pinnedPx}px (${100 - r.mid?.freePct}%) | ${r.perTurn.taps} | ${r.perTurn.scrolls} |`,
  );
