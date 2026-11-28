// Manual check for the phone layout (#59, not run in CI). Start `pnpm play` and `pnpm dev:web`, then:
//   node apps/web/e2e/phone.mjs [http://localhost:5173] [screenshot-dir]
// At 390 px it checks 6- and 10-seat tables (no horizontal scroll, tap targets of 44 px, nav views,
// timer in view), then plays a full game against bots by tapping only.
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const web = process.argv[2] ?? "http://localhost:5173";
const shots = process.argv[3];
const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`ok - ${what}`);
};

async function startGame(browser, width, bots) {
  const page = await (await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
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
  return { page, errors };
}

const tooSmall = (page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "button, summary, select, input:not([type=checkbox]), label:has(input[type=checkbox])",
      ),
    ]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 43.5 || r.height < 43.5);
      })
      .map((el) => `${el.tagName} "${(el.textContent || "").trim().slice(0, 20)}"`),
  );
const overflows = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

/** One step of a human turn, through the cards and buttons. Returns false when there is nothing to do yet. */
async function step(page) {
  const mine = page.locator(".mine");
  if (await page.getByText("Game over").count()) return false;
  await page.getByRole("button", { name: "Table" }).tap({ timeout: 2000 }).catch(() => {});
  const pay = mine.locator(".chooser", { hasText: "You owe" });
  const choose = mine.locator(".chooser").filter({ hasNotText: /You owe|Appeals so far/ });
  if (await pay.count()) {
    for (const box of await pay.getByRole("checkbox").all()) await box.check();
    await pay.getByRole("button", { name: /^Pay/ }).click();
  } else if (await mine.getByRole("button", { name: "Accept" }).count()) {
    await mine.getByRole("button", { name: "Accept" }).first().click();
  } else if (await choose.count()) {
    await choose.getByRole("button").first().click();
  } else if (
    (
      (await page
        .locator(".status-line")
        .textContent({ timeout: 1000 })
        .catch(() => "")) ?? ""
    ).startsWith("You")
  ) {
    const cards = page.locator(".hand-fan .card-select");
    const actions = mine.locator(".hand-actions button");
    for (let i = 0; i < (await cards.count()); i++) {
      if ((await cards.nth(i).getAttribute("aria-pressed")) !== "true") await cards.nth(i).tap({ position: { x: 16, y: 30 } });
      if (await actions.count()) {
        const names = await actions.allTextContents();
        const pick = names.filter((n) => n !== "Discard").length
          ? names.findIndex((n) => n !== "Discard")
          : 0;
        await actions.nth(pick).tap();
        return true;
      }
    }
    if (await mine.getByRole("button", { name: "End turn" }).count())
      await mine.getByRole("button", { name: "End turn" }).click();
    else return false;
  } else return false;
  return true;
}

const inView = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  }, sel);

const browser = await chromium.launch();
try {
  for (const bots of [5, 9]) {
    const { page, errors } = await startGame(browser, 390, bots);
    await page.waitForTimeout(500);
    const n = bots + 1;
    check(!(await overflows(page)), `${n} seats at 390px: no horizontal scroll`);
    check((await page.locator(".strip-chip").count()) === bots, `${n} seats: a chip for each opponent`);
    const small = await tooSmall(page);
    check(small.length === 0, `${n} seats: every control is 44px (${small.join(", ")})`);
    await page.locator(".strip-chip").first().tap();
    check(await page.locator(".peek .tray").count(), `${n} seats: tapping a chip opens that player`);
    check(!(await overflows(page)), `${n} seats: no horizontal scroll with a player open`);
    if (await page.locator(".clock").count())
      check(await inView(page, ".clock"), `${n} seats: the timer is in view`);
    if (shots) await page.screenshot({ path: `${shots}/phone-${n}p-table.png` });
    await page.getByRole("button", { name: "Players" }).tap();
    check((await page.locator(".trays .tray").count()) === bots, `${n} seats: Players lists every opponent`);
    check(!(await overflows(page)), `${n} seats: Players has no horizontal scroll`);
    if (shots) await page.screenshot({ path: `${shots}/phone-${n}p-players.png`, fullPage: true });
    await page.getByRole("button", { name: "Log" }).tap();
    check(await page.locator(".log").isVisible(), `${n} seats: Log is one tap away`);
    check(!(await overflows(page)), `${n} seats: Log has no horizontal scroll`);
    await page.getByRole("button", { name: "Table" }).tap();
    const card = page.locator(".hand-fan .card-select").first();
    await card.tap({ position: { x: 16, y: 30 } });
    check(
      (await page.locator(".card-select[aria-pressed=true]").count()) === 1,
      `${n} seats: tapping a card selects it`,
    );
    check(
      await page.locator(".hand-actions").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom <= innerHeight && r.height >= 44;
      }),
      `${n} seats: the action bar sits at the bottom of the screen`,
    );
    if (shots) await page.screenshot({ path: `${shots}/phone-${n}p-selected.png` });
    check(errors.length === 0, `${n} seats: no console errors ${errors.join(" | ")}`);
    await page.context().close();
  }

  const { page, errors } = await startGame(browser, 390, 2);
  let idle = 0;
  for (let i = 0; i < 6000 && !(await page.getByText("Game over").count()); i++) {
    idle = (await step(page)) ? 0 : idle + 1;
    await page.waitForTimeout(idle ? 120 : 50);
  }
  check(await page.getByText("Game over").count(), "a full game finishes at 390px, by taps");
  check(!(await overflows(page)), "game over at 390px: no horizontal scroll");
  check(errors.length === 0, `full game: no console errors ${errors.join(" | ")}`);
  await page.context().close();
} finally {
  await browser.close();
}
