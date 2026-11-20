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
  await page.goto("/admin/products/new");
  const name = `E2E Kitsune Mask ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Description", { exact: true }).fill("A handcrafted kitsune cosplay mask made for e2e tests.");
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Cosplay" });
  await page.getByLabel("Status", { exact: true }).selectOption("ACTIVE");
  const row = page.locator("tbody tr").first();
  await row.locator("input").nth(0).fill(`E2E-${Date.now()}`);
  await row.locator('input[type="number"]').nth(0).fill("899");
  await page.getByLabel("Initial stock").fill("7");
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByText("Product created.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/products\/[a-z0-9]+$/);
  await page.screenshot(shot("admin-product-edit"));

  await page.goto(`/search?q=${encodeURIComponent("kitsune mask")}`);
  await expect(page.getByRole("link", { name }).first()).toBeVisible();

  await page.goto("/admin/inventory?q=E2E-");
  await expect(page.getByRole("cell", { name: "7" }).first()).toBeVisible();
});
