import { expect, test } from "@playwright/test";

const shot = (name: string) => ({ path: `test-results/screens/${name}.png`, fullPage: false });

test("homepage renders hero, rails and navigation @mobile", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trending now" })).toBeVisible();
  await page.screenshot(shot(`home-${info.project.name}`));
  await page.evaluate(() => window.scrollTo(0, 1100));
  await page.waitForTimeout(400);
  await page.screenshot(shot(`home-scrolled-${info.project.name}`));
});

test("live search shows typo-tolerant suggestions", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("textbox", { name: "Search products" });
  await input.fill("naurto hodie");
  await expect(page.getByText("Did you mean")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Search" }).getByRole("link", { name: /Naruto/ }).first()).toBeVisible();
  await page.screenshot(shot("search-suggest"));
  await input.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=naurto/);
  await expect(page.getByText(/Including results for/)).toBeVisible();
});

test("filters combine and persist in the URL", async ({ page }) => {
  await page.goto("/c/clothing");
  await page.waitForLoadState("networkidle"); // let client filters hydrate before interacting
  const filters = page.getByRole("complementary", { name: "Filters" });
  await filters.getByText("Size", { exact: true }).click();
  await filters.getByRole("button", { name: "M", exact: true }).click();
  await expect(page).toHaveURL(/size=M/);
  await filters.getByLabel("In stock only").click();
  await expect(page).toHaveURL(/instock=1/);
  await expect(page.getByRole("button", { name: "Remove filter Size M" })).toBeVisible();
  await page.getByLabel("Sort products").selectOption("price_asc");
  await expect(page).toHaveURL(/sort=price_asc/);
  await page.screenshot(shot("listing-filters"));
  // Reload keeps state (shareable URL)
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove filter Size M" })).toBeVisible();
});

test("product page enforces variant selection, then adds to cart", async ({ page }) => {
  await page.goto("/c/oversized-t-shirts?instock=1");
  await page.locator("article h3 a").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot(shot("pdp-desktop"));

  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: /select a size/i })).toBeVisible();

  const sizes = page.locator("fieldset", { has: page.getByText("Size", { exact: true }) }).locator("button:not([disabled])");
  const count = await sizes.count();
  for (let i = 0; i < count; i++) {
    await sizes.nth(i).click();
    if (await page.getByText(/In stock|Only \d+ left/).isVisible()) break;
  }
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByRole("dialog", { name: "Shopping cart" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cart, 1 items/ })).toBeVisible();
  await page.screenshot(shot("cart-drawer"));

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /Your cart/ })).toBeVisible();
  await page.getByRole("button", { name: "Increase quantity" }).first().click();
  await expect(page.getByRole("button", { name: /Cart, 2 items/ })).toBeVisible();
  await page.screenshot(shot("cart-page"));
});

test("pincode checker returns delivery options", async ({ page }) => {
  await page.goto("/c/keychains");
  await page.locator("article h3 a").first().click();
  await page.getByLabel("PIN code").fill("560001");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText("Standard delivery")).toBeVisible();
  await page.getByLabel("PIN code").fill("012345");
  await page.getByRole("button", { name: "Check" }).click();
  await expect(page.getByText(/valid 6-digit PIN/)).toBeVisible();
});

test("mobile product page has sticky buy bar and tab bar @mobile", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.goto("/c/hoodies-sweatshirts");
  await expect(page.getByRole("navigation", { name: "Mobile tabs" })).toBeVisible();
  await page.screenshot(shot("listing-mobile"));
  await page.locator("article h3 a").first().click();
  await page.screenshot(shot("pdp-mobile"));
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(500);
  await expect(page.getByText(/Select size|Add to cart/).last()).toBeVisible();
  await page.screenshot(shot("pdp-mobile-sticky"));
});

test("shopper switches to an anime theme and it sticks after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: /Cursed Energy/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-anime", "cursed");
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-anime", "cursed");
  // Preview links (?theme=) override the saved choice for that page.
  await page.goto("/shop?theme=manga");
  await expect(page.locator("html")).toHaveAttribute("data-anime", "manga");
  await page.getByRole("button", { name: "Change theme" }).click();
  await page.getByRole("menuitemradio", { name: /Classic dark/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-anime", /.+/);
});
