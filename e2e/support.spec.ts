import { expect, test } from "@playwright/test";

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "OtakuDemo123";

async function login(page: import("@playwright/test").Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("guest sends a support message; support agent replies and resolves it", async ({ page }) => {
  const subject = `Parcel question ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("link", { name: "Send us a message" }).click();
  await expect(page).toHaveURL(/\/support$/);

  await page.getByLabel("Your name").fill("Riya Sen");
  await page.getByLabel("Email", { exact: true }).fill(`riya-${Date.now()}@test.local`);
  await page.getByLabel("Topic").selectOption("shipping");
  await page.getByLabel("Subject").fill(subject);
  await page.getByLabel("Message").fill("Do you ship to Port Blair, and how long does it take?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Your ticket TK-[A-Z0-9]+ is open/)).toBeVisible();

  await page.context().clearCookies();
  await login(page, "support@otakubazaar.test", "/admin/support");
  await page.getByRole("link", { name: subject }).click();
  await page.getByLabel("Reply").fill("Yes, we ship there. Delivery usually takes a little longer than the mainland.");
  await page.getByLabel("Mark as resolved after sending").check();
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Yes, we ship there.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveValue("RESOLVED");
});

test("store manager adds an FAQ that shows on the help page", async ({ page }) => {
  const id = Date.now();
  const q = `Do you gift wrap? ${id}`;
  const a = `Yes, tick gift wrap at checkout. (${id})`;
  await login(page, "manager@otakubazaar.test", "/admin/faq");
  await expect(page.getByRole("heading", { name: "FAQs" })).toBeVisible();
  const add = page.locator("form").filter({ has: page.getByRole("button", { name: "Add FAQ" }) });
  await add.getByLabel("Section").selectOption("orders");
  await add.getByLabel("Question").fill(q);
  await add.getByLabel("Answer").fill(a);
  await add.getByRole("button", { name: "Add FAQ" }).click();
  await expect(page.getByText(q)).toBeVisible();

  await page.goto("/support");
  await page.getByText(q).click();
  await expect(page.getByText(a)).toBeVisible();
});

test("event endpoint accepts known events only, and the analytics report renders", async ({ page, request }) => {
  const ok = await request.post("/api/events", { data: { name: "page_view", sessionId: "e2e-session-123", path: "/shop?email=x@y.z" } });
  expect(ok.status()).toBe(204);
  const junk = await request.post("/api/events", { data: { name: "drop_table" } });
  expect(junk.status()).toBe(204); // silently ignored

  await login(page, "manager@otakubazaar.test", "/admin/analytics?days=7");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("Conversion funnel")).toBeVisible();
  await expect(page.getByText("Searches with no results")).toBeVisible();
  await page.getByRole("link", { name: "90 days" }).click();
  await expect(page).toHaveURL(/days=90/);
});
