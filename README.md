# The Otaku Bazaar

Premium anime merchandise store: Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6.

> **Status:** this branch is a staged rebuild. Phases 1–3 (storefront, catalog, accounts, cart, wishlist, admin) are built and tested.
> **Checkout and payments are not built yet.** Do not point a live domain at this version until Phase 4 ships. See [Roadmap](#roadmap).

## What works today

**Storefront**
- Dark-first premium design with a light mode, mega menus, a mobile drawer, an app-style bottom tab bar, and a cart drawer.
- Homepage built from database sections (hero carousel, category and anime tiles, product rails, collections, promo banner, reviews, recently viewed, newsletter). Admins can reorder, rename and hide sections.
- Listing pages for all products, categories, anime, collections and search. Filters cover category, anime, size, colour, brand, price range, rating, discount, type, stock, sale, new and limited. Filters combine, live in the URL (so links are shareable), and show as removable chips. Grid, compact and list views; pagination; empty states; loading skeletons.
- Search with autocomplete, typo tolerance (pg_trgm plus Levenshtein correction, e.g. "naurto hodie" finds Naruto hoodies), SKU search, "did you mean", recent searches, trending searches and quick add.
- Product pages: gallery with hover zoom, fullscreen view, swipe and video. Variant-aware colour/size/model selection with per-option stock (unavailable variants can't be bought), quantity, add to cart, buy now, wishlist, share, PIN code delivery dates and costs from shipping zones, back-in-stock alerts, specs, size guide, return policy, a rating breakdown with review sort and filter, customer photos, Q&A (questions go to moderation), frequently bought together, related products, recently viewed, and Product/Breadcrumb JSON-LD.
- Cart: persistent guest cart (signed httpOnly cookie) that merges into the account on login. Stock is checked on every change and lines are flagged when stock drops. Includes save for later, gift wrap and message, a free-shipping progress bar, and a summary with inclusive GST.
- Wishlist synced to the account, with move to cart, price-drop indicator and a public share link.
- Accounts: email/password with scrypt hashing, email verification, forgot/reset password, Google OAuth (PKCE), profile, change password, active sessions, and "sign out other devices".
- SEO: per-page metadata, canonical URLs, Open Graph, sitemap.xml, robots.txt and Organization JSON-LD.
- Editable policy page templates with clear `[placeholders]`. No business details are invented.

**Admin (`/admin`)**, with role-based access (Super Admin, Store Manager, Product Manager, Order Manager, Support Agent, Marketing Manager)
- Dashboard with real metrics from the database.
- Products: create, edit, archive or delete; bulk status changes; image upload (byte-sniffed, 4 MB limit, S3 or local in dev); variant matrix generator; SKUs; prices and compare-at prices; scheduled launches; SEO fields.
- Inventory: variant-level stock with an atomic, oversell-proof stock ledger, low/out-of-stock views, adjust or count, and per-variant history.
- Categories and anime franchises, homepage sections and banners, policy pages (Markdown), store settings (announcement bar, shipping thresholds, tax display, support, social, maintenance mode), staff roles, and an audit log.

**Security**: server-side validation (zod) everywhere; prices are always read from the database; session tokens, reset tokens and email tokens are stored only as SHA-256 hashes; account lockout plus Postgres-backed rate limiting; same-origin checks; CSP and security headers; a safe Markdown renderer (never raw HTML); open-redirect protection; audit logging.

## Run locally

Requirements: Node 20.9+ and PostgreSQL 15+ (the `pg_trgm` and `fuzzystrmatch` extensions are included in standard Postgres builds).

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm install
npm run db:migrate              # applies prisma/migrations
SEED_DEMO_ACCOUNTS=true npm run db:seed
npm run dev                     # http://localhost:3000
```

Emails (verification, password reset) print to the server console until `RESEND_API_KEY` is set.

### Demo accounts (development seed only)

Created only when `SEED_DEMO_ACCOUNTS=true` and `NODE_ENV` is not `production`. The password for all of them is `OtakuDemo123`, or `SEED_DEMO_PASSWORD` if you set it.

| Email | Role |
|---|---|
| admin@otakubazaar.test | Super Admin |
| manager@otakubazaar.test | Store Manager |
| products@otakubazaar.test | Product Manager |
| orders@otakubazaar.test | Order Manager |
| support@otakubazaar.test | Support Agent |
| marketing@otakubazaar.test | Marketing Manager |
| customer@otakubazaar.test | Customer |

The seed creates **84 demo products** (332 variants) with generated placeholder art labelled "DEMO IMAGE", and 216 demo reviews that are *not* marked as verified purchases. Every demo product has the tag `demo`. Before launch, archive them in Admin → Products (search "demo") and add your real catalog.

## Tests

```bash
npm run typecheck
TEST_DATABASE_URL=postgresql://…/otaku_test npm test   # unit + integration; refuses DBs without "test" in the name
npm run build && npm run test:e2e                       # Playwright, desktop + mobile, against the seeded DB
```

The suites cover:
- **Unit:** money and GST maths, URL filter round-trips, password hashing, signed cookies, RBAC, upload sniffing, Markdown/XSS safety and delivery dates.
- **Integration:** auth (lockout, rate limits, single-use tokens, OAuth linking), cart (stock limits, concurrent adds, merge), inventory (no overselling under concurrency) and admin product creation.
- **E2E:** search, filters, the PDP-to-cart flow, the PIN code checker, signup with cart merge, the wishlist, RBAC redirects and admin product creation.

CI (`.github/workflows/ci.yml`) runs all of the above against Postgres 17 on every pull request.

## Deploy to Vercel

**Only one setting is needed: connect a Neon database in Vercel (one click).** Email, Google sign-in, social links, business details and everything else are managed in the admin panel.


Follow **[docs/DEPLOY-VERCEL.md](docs/DEPLOY-VERCEL.md)**. It's a browser-only, step-by-step guide covering the Neon database, Blob image storage, environment variables, the first owner account, email, Google login and a custom domain.

Each Vercel build runs `scripts/vercel-build.sh`. It applies database migrations, seeds the base store data on the first deploy only (never overwriting admin edits), optionally promotes `BOOTSTRAP_ADMIN_EMAIL` to the first Super Admin, then builds the site.

## Security, legal and licence

- [SECURITY.md](SECURITY.md): how data is protected, how to report a vulnerability, and the operator checklist (2FA, roles, backups).
- [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md): business registration, GST, mandatory website disclosures, policy pages, anime IP and licensing risk, payment gateway KYC, and DPDP privacy duties.
- Policy page templates (Terms, Privacy, Shipping, Returns, Cancellation, Payment, Grievance Redressal, Cookies, Disclaimer, IP) are created on first setup. Edit them in **Admin → Pages & policies**.
- [LICENSE](LICENSE): proprietary. Owner: Satyam Behera. Built by Rajeev (keep the "Made by Rajeev" footer credit).

## Project layout

```
prisma/            schema.prisma (all commerce entities), migrations, seed
src/app/(store)/   storefront routes        src/app/admin/   admin routes + server actions
src/app/api/       search, cart, uploads, OAuth, demo art
src/server/        domain logic: auth, cart, catalog, inventory, wishlist, shipping, storage, settings
src/components/    ui/ (design system), store/, admin/, auth/, account/
src/lib/           shared pure helpers (money, filters, markdown, seo)
tests/ e2e/        vitest unit/integration, Playwright e2e
```

## Roadmap

The database schema already contains the tables for every later phase (orders, payments, shipments, returns, refunds, coupons, gift cards, loyalty, tickets and notifications), so the next phases add features without reworking the schema.

| Phase | Scope | Status |
|---|---|---|
| 1–3 | Design system, storefront, catalog, search, filters, PDP, cart, wishlist, auth, admin products/inventory/content/RBAC | ✅ This PR |
| 4 | Checkout, addresses, coupon engine, Razorpay (UPI/cards/net banking/wallets) and COD, webhooks, idempotency, stock reservation, orders, tracking page, cancellations and refunds, invoices, admin orders and coupons | ✅ Done (Stripe/international later) |
| 5 | Shiprocket (book courier, labels, webhook tracking), returns/exchanges/replacements with restock and partial refunds, simpler mobile-friendly product editor | ✅ Done |
| 6 | Customer order history, reviews from verified orders, support tickets + widget, notifications/templates, loyalty, gift cards | |
| 7 | Analytics dashboards + consent-aware GA4/Meta Pixel, blog, multi-currency/markets, abandoned cart recovery | |
| 8 | Security review, performance tuning, load tests, production hardening | |
