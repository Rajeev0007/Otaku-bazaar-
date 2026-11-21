import { expect, test } from "@playwright/test";

const shot = (n: string) => ({ path: `test-results/screens/${n}.png`, fullPage: true });

test("guest buys with a coupon and cash on delivery, then admin ships it @mobile", async ({ page, browser }, info) => {
  await page.goto("/c/stickers?instock=1");
  await page.waitForLoadState("networkidle");
  const card = page.locator("article").first();
  if (info.project.name === "mobile") {
    await card.locator("h3 a").click();
    await page.getByRole("button", { name: "Add to cart" }).first().click();
  } else {
    await card.hover();
    await card.getByRole("button", { name: "Quick add" }).click();
  }
  await expect(page.getByRole("dialog", { name: "Shopping cart" })).toBeVisible();
  await page.getByRole("dialog", { name: "Shopping cart" }).getByRole("link", { name: "Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);

  const email = `e2e-buyer-${Date.now()}-${info.project.name}@example.com`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mobile number").fill("+91 98765 43210");
  await page.getByLabel("Full name").fill("Asha Rao");
  await page.getByLabel("Phone", { exact: true }).fill("+91 98765 43210");
  await page.getByLabel("House / flat, street").fill("12 MG Road");
  await page.getByLabel("PIN code").fill("560001");
  await page.getByLabel("City").fill("Bengaluru");
  await page.getByLabel("State").selectOption("Karnataka");
  await expect(page.getByText("Standard delivery")).toBeVisible();

  const coupon = page.locator('input[aria-label="Coupon code"]:visible');
  await coupon.fill("freeship");
  await page.locator("form:has(input[aria-label='Coupon code']:visible)").getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("FREESHIP", { exact: true }).locator("visible=true").first()).toBeVisible();
  await page.getByLabel(/Cash on delivery/).check();
  await page.screenshot(shot(`checkout-${info.project.name}`));
  await page.getByRole("button", { name: /Place order/ }).last().click();

  await expect(page).toHaveURL(/\/order\/OB\d{6}-[A-Z0-9]{5}/);
  await expect(page.getByText("Thank you! Your order is confirmed.")).toBeVisible();
  await expect(page.getByText(/Cash on delivery ·/)).toBeVisible();
  await page.screenshot(shot(`order-${info.project.name}`));
  const number = page.url().match(/OB\d{6}-[A-Z0-9]{5}/)![0];
  await expect(page.getByRole("button", { name: /Cart, 0 items/ }).first()).toBeAttached();

  // Another browser can't open the order without the link or a lookup
  const stranger = await browser.newPage();
  expect((await stranger.goto(`/order/${number}`))?.status()).toBe(404);
  await stranger.goto(`/track?order=${number}`);
  await stranger.getByLabel("Email", { exact: true }).fill(email);
  await stranger.getByRole("button", { name: "Track order" }).click();
  await expect(stranger).toHaveURL(new RegExp(`/order/${number}`));
  await stranger.close();

  if (info.project.name !== "desktop") return;
  // Admin ships it
  await page.context().clearCookies();
  await page.goto("/login?next=/admin/orders");
  await page.getByLabel("Email", { exact: true }).fill("orders@otakubazaar.test");
  await page.getByLabel("Password", { exact: true }).fill("OtakuDemo123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: number }).click();
  await page.getByLabel("New status").selectOption("SHIPPED");
  await page.getByLabel("Courier (for Shipped)").fill("Delhivery");
  await page.getByLabel("Tracking number").fill("DLV12345");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByText("Order updated.")).toBeVisible();
  await expect(page.getByText("DLV12345")).toBeVisible();
  await page.screenshot(shot("admin-order"));
  const csv = await page.request.get("/api/admin/export/orders");
  expect(await csv.text()).toContain(number);
});
