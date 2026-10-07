import { expect, test, type Page } from "@playwright/test";

async function select(page: Page, cross = false) {
  await page.getByRole("button", { name: /Choose Sky Vault/ }).click();
  if (cross) await page.getByRole("button", { name: "Steal instead using Double Cross" }).click();
  await page.getByRole("button", { name: cross ? "Steal the loot" : "Grab loot", exact: true }).click();
}

test("two isolated browsers play the rebuilt game, keep loot secret, reconnect, and rematch", async ({ browser }) => {
  test.setTimeout(120000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const host = await hostContext.newPage(); const guest = await guestContext.newPage();
  const errors: string[] = [];
  host.on("pageerror", (error) => errors.push(error.message)); guest.on("pageerror", (error) => errors.push(error.message));
  await host.goto("/");
  await host.getByRole("tab", { name: "With friends" }).click();
  await host.getByLabel("YOUR NAME", { exact: true }).fill("Alice");
  await host.getByRole("button", { name: "Create the room" }).click();
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{6}$/);
  const url = host.url(); const endpoint = url.replace(/\/room\//, "/api/rooms/");
  await guest.goto(url); await guest.getByLabel("YOUR NAME", { exact: true }).fill("Bob");
  await guest.getByRole("button", { name: "Join the crew" }).click();
  await expect(host.getByText("Bob", { exact: true })).toBeVisible();
  await guest.getByRole("button", { name: "I’m ready" }).click();
  await expect(host.getByRole("button", { name: "Start playing" })).toBeEnabled();
  await host.getByRole("button", { name: "Start playing" }).click();
  await expect(guest.getByRole("heading", { name: "Round 1 of 4" })).toBeVisible();
  const scene = host.locator(".vault-game .vault-scene");
  await expect(scene).toHaveAttribute("data-renderer", "ready");
  const canvas = scene.locator("canvas"); const bounds = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: bounds.width / 2, y: bounds.height * .45 } });
  await expect(host.getByRole("button", { name: /Choose Sky Vault/ })).toHaveAttribute("aria-pressed", "true");
  await host.screenshot({ path: "test-results/vaults-desktop.png", fullPage: true });
  await guest.screenshot({ path: "test-results/vaults-mobile.png", fullPage: true });
  expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await select(host, true);
  await expect(host.getByRole("button", { name: "Choice locked", exact: true })).toBeVisible();
  const guestState = await (await guest.request.get(endpoint)).json();
  expect(guestState.mySubmission).toBeNull(); expect(guestState.players[0].doubleCrossAvailable).toBe(true);
  expect(guestState.players[0].score).toBeNull(); expect(guestState.submissions).toBeUndefined();
  await select(guest);
  await expect(host.getByRole("heading", { name: "You stole the whole vault!" })).toBeVisible();
  await expect(guest.getByRole("heading", { name: "Someone stole your share!" })).toBeVisible();
  await expect(host.getByTestId("score-Alice")).toHaveText("$10,000");
  await expect(host.getByTestId("score-Bob")).toHaveText("HIDDEN");
  await guest.reload(); await expect(guest.getByRole("heading", { name: "Someone stole your share!" })).toBeVisible();
  for (let round = 2; round <= 4; round++) {
    await expect(host.getByRole("heading", { name: `Round ${round} of 4` })).toBeVisible({ timeout: 15000 });
    for (const player of [host, guest]) {
      await expect(player.locator(".vault-game .vault-scene")).toHaveAttribute("data-stage", ["bank", "train", "sky", "gold"][round - 1]);
      await expect(player.locator(".vault-game .vault-scene")).toHaveAttribute("data-renderer", "ready");
    }
    await expect(host.getByRole("button", { name: "Steal instead using Double Cross" })).toBeDisabled();
    await select(host); await select(guest);
    await expect(host.getByRole("heading", { name: "You got the loot!" })).toBeVisible();
  }
  await expect(host.getByRole("heading", { name: "The final loot." })).toBeVisible({ timeout: 15000 });
  await expect(guest.getByRole("heading", { name: "The final loot." })).toBeVisible();
  await expect(host.getByTestId("score-Bob")).toHaveText("$21,000");
  await host.getByRole("button", { name: "Play again" }).click();
  await expect(guest.getByRole("heading", { name: "Who’s coming?" })).toBeVisible();
  expect(errors).toEqual([]); await hostContext.close(); await guestContext.close();
});

test("the demo teaches sharing and stealing and the homepage fits on mobile", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage(); await page.goto("/");
  await expect(page.getByRole("heading", { name: "Pick a vault. Grab the loot." })).toBeVisible();
  await expect(page.locator(".hero-vault .vault-scene")).toHaveAttribute("data-renderer", "ready");
  await expect(page.locator(".hero-vault .vault-scene")).toHaveAttribute("data-motion", "paused");
  await page.getByRole("button", { name: /^Open the vault/ }).click();
  await expect(page.getByRole("button", { name: /^Close the vault/ })).toBeVisible();
  await page.locator(".hero-vault").getByRole("button", { name: "Resume motion" }).click();
  await expect(page.locator(".hero-vault .vault-scene")).toHaveAttribute("data-motion", "playing");
  await page.locator(".hero-vault").getByRole("button", { name: "Pause motion" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: /Demo step 4/ }).click();
  await expect(page.getByRole("heading", { name: "Share the treasure." })).toBeVisible();
  await expect(page.locator(".demo-runner > span").first()).toHaveText("$5,000");
  await expect(page.getByRole("region", { name: "Demo payout" })).toHaveAttribute("data-payout", "collected");
  await expect(page.locator(".demo-loot strong")).toHaveText("$0");
  await page.getByRole("button", { name: "Use Double Cross", exact: true }).click();
  await expect(page.locator(".demo-runner > span").first()).toHaveText("$10,000");
  await expect(page.locator(".demo-runner > span").last()).toHaveText("$0");
  await page.locator(".demo-stage").screenshot({ path: "test-results/vault-open.png" });
  await page.screenshot({ path: "test-results/home-mobile.png", fullPage: true });
  await page.getByRole("tab", { name: "Join room" }).click();
  await page.getByLabel("YOUR NAME", { exact: true }).fill("Test"); await page.getByLabel("ROOM CODE", { exact: true }).fill("ZZZZZZ");
  await page.getByRole("button", { name: "Join the crew" }).click(); await expect(page.locator(".entry-card [role=alert]")).toContainText("Room not found");
  await page.getByRole("link", { name: "The rules", exact: true }).click();
  await expect(page.getByRole("heading", { name: "3. One optional steal" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});

test("Loot visibly collects, replays, and the four stage previews work on desktop and phone", async ({ browser }) => {
  test.setTimeout(90000);
  for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: "no-preference" });
    const page = await context.newPage(); const errors: string[] = []; const actions: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => { if (new URL(request.url()).pathname.startsWith("/api/rooms")) actions.push(request.url()); });
    await page.goto("/");
    const preview = page.getByRole("tabpanel");
    const settings = ["Street Bank", "Armored Train", "Sky Bank", "Crown Vault"];
    for (let i = 0; i < settings.length; i++) {
      await page.getByRole("tab", { name: new RegExp(settings[i]) }).click();
      await expect(preview.getByRole("heading", { name: settings[i], exact: true })).toBeVisible();
      await expect(preview.locator(".vault-scene")).toHaveAttribute("data-stage", ["bank", "train", "sky", "gold"][i]);
      await expect(preview.locator(".vault-scene")).toHaveAttribute("data-renderer", "ready");
      await preview.getByRole("button", { name: "Open Gold Vault preview" }).click();
      await expect(preview.getByRole("button", { name: "Close Gold Vault preview" })).toHaveAttribute("aria-pressed", "true");
      await preview.screenshot({ path: `test-results/stage-${i + 1}-${mobile ? "mobile" : "desktop"}.png` });
    }
    await page.getByRole("tab", { name: /Crown Vault/ }).press("Home");
    await expect(page.getByRole("tab", { name: /Street Bank/ })).toBeFocused();
    await expect(preview.locator(".vault-scene")).toHaveAttribute("data-stage", "bank");
    await page.getByRole("button", { name: /Demo step 3/ }).click();
    await expect(page.locator(".demo-loot strong")).toHaveText("$10,000");
    const payout = page.getByRole("region", { name: "Demo payout" });
    for (let replay = 0; replay < 2; replay++) {
      await page.getByRole("button", { name: /Demo step 4/ }).click();
      await expect(payout).toHaveAttribute("data-payout", "collecting");
      await expect(page.locator(".demo-coin-transfers")).toBeVisible();
      await expect(payout).toHaveAttribute("data-payout", "collected");
      await expect(payout.locator(".demo-wallet strong")).toHaveText(["$5,000", "$5,000"]);
      await expect(page.locator(".demo-loot strong")).toHaveText("$0");
    }
    await page.getByRole("button", { name: "Use Double Cross", exact: true }).click();
    await expect(payout).toHaveAttribute("data-payout", "collected");
    await expect(payout.locator(".demo-wallet strong")).toHaveText(["$10,000", "$0"]);
    await page.getByRole("button", { name: "Share the loot", exact: true }).click();
    await expect(payout).toHaveAttribute("data-payout", "collected");
    await expect(payout.locator(".demo-wallet strong")).toHaveText(["$5,000", "$5,000"]);
    await page.locator(".vault-demo").screenshot({ path: `test-results/demo-loot-${mobile ? "mobile" : "desktop"}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(actions).toEqual([]); expect(errors).toEqual([]);
    await context.close();
  }
});

test("solo practice starts in one click and plays all four rounds through the UI", async ({ page }) => {
  test.setTimeout(90000); await page.goto("/");
  await page.getByRole("button", { name: "Play vs computer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 1 of 4" })).toBeVisible();
  await expect(page.getByTestId("score-Byte")).toBeVisible();
  for (let round = 1; round <= 4; round++) {
    await expect(page.getByRole("heading", { name: `Round ${round} of 4` })).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".vault-game .vault-scene")).toHaveAttribute("data-stage", ["bank", "train", "sky", "gold"][round - 1]);
    await expect(page.locator(".vault-game .vault-scene")).toHaveAttribute("data-renderer", "ready");
    await page.getByRole("button", { name: /Choose Gold Vault/ }).click();
    await page.getByRole("button", { name: "Grab loot", exact: true }).click();
    await expect(page.locator(".simple-reveal")).toBeVisible();
    await expect(page.getByTestId("score-Byte")).toHaveText("HIDDEN");
  }
  await expect(page.getByRole("heading", { name: "The final loot." })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("score-Byte")).not.toHaveText("HIDDEN");
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByRole("heading", { name: "Round 1 of 4" })).toBeVisible();
});

test("a device without WebGL can still play using accessible vault buttons", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  const page = await context.newPage(); await page.goto("/");
  await expect(page.locator(".hero-vault .vault-scene")).toHaveAttribute("data-renderer", "fallback");
  await page.getByRole("tab", { name: /Armored Train/ }).click();
  await expect(page.getByRole("tabpanel").locator(".vault-scene")).toHaveAttribute("data-stage", "train");
  await page.getByRole("tabpanel").getByRole("button", { name: "Open Gold Vault preview" }).click();
  await expect(page.getByRole("tabpanel").locator(".css-safe.open")).toHaveCount(1);
  await page.getByRole("button", { name: /Demo step 4/ }).click();
  await expect(page.getByRole("region", { name: "Demo payout" })).toHaveAttribute("data-payout", "collected");
  await expect(page.locator(".demo-stage .css-safe > b")).toHaveCount(0);
  await page.getByRole("button", { name: "Play vs computer", exact: true }).click();
  await expect(page.locator(".vault-game .vault-scene")).toHaveAttribute("data-renderer", "fallback");
  await select(page); await expect(page.locator(".simple-reveal")).toBeVisible(); await context.close();
});

test("unauthenticated and forged state-changing requests are rejected", async ({ request }) => {
  expect((await request.post("/api/rooms", { data: { nickname: "Attacker", roundSeconds: 20 } })).status()).toBe(401);
  expect((await request.post("/api/session", { headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  await request.post("/api/session");
  const room = await (await request.post("/api/rooms", { data: { nickname: "Tester", roundSeconds: 20 } })).json();
  const response = await request.patch(`/api/rooms/${room.code}`, { data: { type: "ready", ready: true, score: 999999, matchId: room.matchId, expectedRound: 0 } });
  expect(response.status()).toBe(400);
});
