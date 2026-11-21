import { expect, test } from "@playwright/test";

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "OtakuDemo123";
const shot = (name: string) => ({ path: `test-results/screens/${name}.png` });

async function login(page: import("@playwright/test").Page, email: string, next = "/account") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("guest cart survives sign-up; wishlist syncs to the account", async ({ page }) => {
  await page.goto("/c/stickers?instock=1");
  await page.locator("article").first().hover();
  await page.locator("article").first().getByRole("button", { name: "Quick add" }).click();
  await expect(page.getByRole("button", { name: /Cart, 1 items/ })).toBeVisible();

  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Fan");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("weak");
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();
  // React resets the form after the failed action; wait for that before typing again.
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email); // typed values survive the error
  await page.getByLabel("Password", { exact: true }).fill("strongpass123");
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account\?welcome=1/);
  await expect(page.getByText("Please confirm your email address")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cart, 1 items/ })).toBeVisible();
  await page.screenshot(shot("account"));

  await page.goto("/c/posters-wall-art");
  await page.locator("article").first().getByRole("button", { name: /Save .* to wishlist/ }).click();
  await expect(page.getByText("Saved to wishlist")).toBeVisible();
  await page.goto("/wishlist");
  await expect(page.locator("article")).toHaveCount(1);
  await page.screenshot(shot("wishlist"));

  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
});

test("wrong password shows a generic error", async ({ page }) => {
  await login(page, "customer@otakubazaar.test");
  await expect(page).toHaveURL(/\/account/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("customer@otakubazaar.test");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("customers and under-privileged staff cannot reach admin areas", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
  await login(page, "customer@otakubazaar.test", "/admin");
  await expect(page).toHaveURL(/\/forbidden/);
  await page.context().clearCookies();

  await login(page, "support@otakubazaar.test", "/admin/products");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add product" })).toHaveCount(0);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/forbidden/);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/forbidden/);
});

test("product manager creates a product that appears in the store", async ({ page }) => {
  await login(page, "products@otakubazaar.test", "/admin");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.screenshot(shot("admin-dashboard"));

  // Simple product: name, category, price, stock. SKU generated automatically.
  await page.goto("/admin/products/new");
  const name = `E2E Kitsune Mask ${Date.now()}`;
  await page.getByLabel("Product name").fill(name);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Cosplay" });
  await page.getByLabel("Price (₹)").fill("899");
  await page.getByLabel("Stock", { exact: true }).fill("7");
  await page.screenshot({ path: "test-results/screens/admin-product-simple.png", fullPage: true });
  await page.getByRole("button", { name: "Publish product" }).click();
  await expect(page.getByText("Product created.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/[a-z0-9]+$/);
  await page.goto(`/search?q=${encodeURIComponent("kitsune mask")}`);
  await expect(page.getByRole("link", { name }).first()).toBeVisible();

  // Product with sizes and colours
  await page.goto("/admin/products/new");
  const tee = `E2E Option Tee ${Date.now()}`;
  await page.getByLabel("Product name").fill(tee);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Clothing › Oversized T-Shirts" });
  await page.getByLabel("Price (₹)").fill("999");
  await page.getByLabel("MRP / was (₹)").fill("1299");
  await page.getByRole("button", { name: /Sizes \/ colours/ }).click();
  for (const sz of ["M", "L"]) await page.getByRole("button", { name: sz, exact: true }).click();
  await page.getByRole("button", { name: "Black" }).click();
  await page.getByRole("button", { name: "White", exact: true }).click();
  await expect(page.getByText("4 options")).toBeVisible();
  await page.getByLabel("Stock for all options").fill("5");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.screenshot({ path: "test-results/screens/admin-product-options.png", fullPage: true });
  await page.getByRole("button", { name: "Publish product" }).click();
  await expect(page.getByText("Product created.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/[a-z0-9]{20,}$/);
  await page.reload();
  await expect(page.getByText("4 options · 20 in stock")).toBeVisible();
  // Edit stock directly: recorded in the stock history
  await page.getByLabel("Stock for White M").fill("9");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Product saved.")).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent(tee)}`);
  await page.getByRole("link", { name: tee }).first().click();
  await expect(page.getByText("23% off").first()).toBeVisible();
});

test("admin works on a phone @mobile", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await login(page, "products@otakubazaar.test", "/admin/products");
  await expect(page.getByRole("button", { name: "Open admin menu" })).toBeVisible();
  await page.screenshot(shot("admin-mobile-products"));
  await page.getByRole("button", { name: "Open admin menu" }).click();
  await page.getByRole("link", { name: "Inventory" }).click();
  await expect(page).toHaveURL(/\/admin\/inventory/);
  await page.goto("/admin/products/new");
  await page.getByLabel("Product name").fill(`Phone-made Poster ${Date.now()}`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Posters & Wall Art" });
  await page.getByLabel("Price (₹)").fill("399");
  await page.getByLabel("Stock", { exact: true }).fill("3");
  await page.screenshot({ path: "test-results/screens/admin-mobile-new.png", fullPage: true });
  await page.getByRole("button", { name: "Publish product" }).click();
  await expect(page.getByText("Product created.")).toBeVisible();
});
