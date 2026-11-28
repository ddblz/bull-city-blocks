// Manual check for the table layout (#58, not run in CI). Start `pnpm play` and `pnpm dev:web`, then:
//   node apps/web/e2e/table.mjs [http://localhost:5173] [screenshot-dir]
// At 1280 and 820 px it checks a 2- and a 10-seat table (no horizontal scroll, tap targets of 44 px,
// keyboard selection), then plays a full game against bots through the cards and buttons.
// PHONE=1 runs the phone layout (#59) instead: 390 px, 6 and 10 seats, tapping only.
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const web = process.argv[2] ?? "http://localhost:5173";
const shots = process.argv[3];
const phone = process.env.PHONE === "1";
const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`ok - ${what}`);
};

async function startGame(browser, width, bots) {
  const touch = width < 640 ? { hasTouch: true, isMobile: true } : {};
  const context = await browser.newContext({ viewport: { width, height: 900 }, ...touch });
  const page = await context.newPage();
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
  const nav = page.getByRole("button", { name: "Table" });
  if (await nav.isVisible()) await nav.click();
  const mine = page.locator(".mine");
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
      if ((await cards.nth(i).getAttribute("aria-pressed")) !== "true")
        await cards.nth(i).click({ position: { x: 16, y: 30 } });
      if (await actions.count()) {
        const names = await actions.allTextContents();
        const pick = names.filter((n) => n !== "Discard").length
          ? names.findIndex((n) => n !== "Discard")
          : 0;
        await actions.nth(pick).click();
        return true;
      }
    }
    if (await mine.getByRole("button", { name: "End turn" }).count())
      await mine.getByRole("button", { name: "End turn" }).click();
    else return false;
  } else return false;
  return true;
}

const browser = await chromium.launch();
try {
  for (const width of phone ? [390] : [1280, 820]) {
    for (const bots of phone ? [5, 9] : [1, 9]) {
      const { page, errors } = await startGame(browser, width, bots);
      await page.waitForTimeout(500);
      check(!(await overflows(page)), `${bots + 1} seats at ${width}px: no horizontal scroll`);
      check(
        (await page.locator(".tray").count()) === bots,
        `${bots + 1} seats at ${width}px: a tray for each opponent`,
      );
      const small = await tooSmall(page);
      check(
        small.length === 0,
        `${bots + 1} seats at ${width}px: every control is 44px (${small.join(", ")})`,
      );
      if (shots)
        await page.screenshot({ path: `${shots}/table-${bots + 1}p-${width}.png`, fullPage: true });
      if (phone) await phoneChecks(page, bots);
      check(
        errors.length === 0,
        `${bots + 1} seats at ${width}px: no console errors ${errors.join(" | ")}`,
      );
      await page.context().close();
    }

    const { page, errors } = await startGame(browser, width, 2);
    if (!phone) await keyboardChecks(page);
    await playOut(page, width, errors);
  }
} finally {
  await browser.close();
}

async function keyboardChecks(page) {
  await page.keyboard.press("Tab");
  for (
    let i = 0;
    i < 40 &&
    !(await page.evaluate(() => document.activeElement?.classList.contains("card-select")));
    i++
  )
    await page.keyboard.press("Tab");
  check(
    await page.evaluate(() => document.activeElement?.classList.contains("card-select")),
    "Tab reaches a hand card",
  );
  check(
    await page.evaluate(
      () => parseFloat(getComputedStyle(document.activeElement).outlineWidth) > 0,
    ),
    "a focused card has a visible focus ring",
  );
  await page.keyboard.press("Enter");
  check(
    (await page.locator(".card-select[aria-pressed=true]").count()) === 1,
    "Enter selects the card",
  );
  await page.keyboard.press("Enter");
  check(
    (await page.locator(".card-select[aria-pressed=true]").count()) === 0,
    "Enter again deselects it",
  );
}

async function playOut(page, width, errors) {
  let idle = 0;
  for (let i = 0; i < 6000 && !(await page.getByText("Game over").count()); i++) {
    idle = (await step(page).catch(() => false)) ? 0 : idle + 1;
    await page.waitForTimeout(idle ? 120 : 50);
  }
  if (shots) await page.screenshot({ path: `${shots}/game-over-${width}.png`, fullPage: true });
  check(await page.getByText("Game over").count(), `a full game finishes at ${width}px`);
  check(!(await overflows(page)), `game over at ${width}px: no horizontal scroll`);
  check(errors.length === 0, `full game at ${width}px: no console errors ${errors.join(" | ")}`);
  await page.context().close();
}

/** The phone layout: strip of opponents, the nav's three views, the bottom action bar. */
async function phoneChecks(page, bots) {
  const n = `${bots + 1} seats`;
  check((await page.locator(".strip-chip").count()) === bots, `${n}: a chip for each opponent`);
  await page.locator(".strip-chip").first().tap();
  check(await page.locator(".peek .tray").count(), `${n}: tapping a chip opens that player`);
  check(!(await overflows(page)), `${n}: no horizontal scroll with a player open`);
  await page.getByRole("button", { name: "Players" }).tap();
  check((await page.locator(".trays .tray").count()) === bots, `${n}: Players lists everyone`);
  check(!(await overflows(page)), `${n}: Players has no horizontal scroll`);
  await page.getByRole("button", { name: "Log" }).tap();
  check(await page.locator(".log").isVisible(), `${n}: Log is one tap away`);
  await page.getByRole("button", { name: "Table" }).tap();
  await page
    .locator(".hand-fan .card-select")
    .first()
    .tap({ position: { x: 16, y: 30 } });
  check(
    (await page.locator(".card-select[aria-pressed=true]").count()) === 1,
    `${n}: a tap selects`,
  );
  const bar = await page.locator(".hand-actions").boundingBox();
  check(bar && bar.y + bar.height <= 900 && bar.height >= 44, `${n}: the action bar is on screen`);
}
