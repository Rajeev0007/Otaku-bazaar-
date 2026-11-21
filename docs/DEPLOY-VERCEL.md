# Host The Otaku Bazaar on Vercel: step by step

Everything below happens in your web browser. No terminal or coding is needed.
Expect about 30–45 minutes the first time.

You will set up three free accounts and connect them:

| Service | What it does | Cost to start |
|---|---|---|
| **GitHub** | Stores the code (you already have this) | Free |
| **Vercel** | Runs the website | Free (Hobby). Use **Pro** once you sell commercially, because Vercel's Hobby plan is for non-commercial use |
| **Neon** (through Vercel) | The PostgreSQL database for products, customers and carts | Free tier |
| **Vercel Blob** | Stores the product photos you upload | Free tier |
| **Resend** (optional, recommended) | Sends verification and password-reset emails | Free tier |

> **Important:** this version has **no checkout yet** (that's Phase 4). Shoppers can browse, sign up, and build carts and wishlists, but they can't pay. Until checkout is added, run it as a **preview/staging** site and keep your current store live.

---

## Step 1: Merge or preview the code

The new store is in pull request **#1** (branch `rebuild-nextjs`).

- **To try it first (recommended):** skip this step. Vercel creates a preview website for the branch automatically in Step 3.
- **To make it your main site:** open the PR on GitHub, click **Merge pull request**, then **Confirm merge**. This replaces the old store on `main`, so only do it when you're ready.

---

## Step 2: Create a Vercel account

1. Go to **vercel.com** and click **Sign Up**.
2. Choose **Continue with GitHub** and approve access.
3. When asked which repositories Vercel can see, allow **Rajeev0007/Otaku-bazaar-**.

---

## Step 3: Import the project

> **Already have a Vercel project for the old store?** Reuse it: open it, go to **Settings → Build and Deployment**, set **Framework Preset** to **Next.js**, and switch **off** any Build/Output/Install command overrides so `vercel.json` takes effect. Then continue at **Step 4**. You can delete the old store's `RAZORPAY_*`, `ADMIN_KEY`, `SMTP_*` and Upstash variables later; the new store doesn't use them yet.

1. In Vercel, click **Add New… → Project**.
2. Find **Otaku-bazaar-** and click **Import**.
3. Leave every setting as it is. The repository's `vercel.json` already sets the framework (Next.js), install command (`npm ci`), build command (`npm run vercel-build`, which also updates the database) and server region (Singapore, `sin1`, next to the database).
4. Click **Deploy**.

The first build succeeds even without a database. Visiting the site shows a **setup page** listing what's still missing. Continue to Step 4.

---

## Step 4: Add the database (Neon)

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database**, choose **Neon** (Serverless Postgres), and click **Continue**.
3. Pick region **Singapore (aws-ap-southeast-1)**, which is closest to India and matches the site's server region in `vercel.json`. If you choose a different region, change `"regions"` in `vercel.json` to the nearest Vercel region (for example `bom1` for Mumbai). Choose the **Free** plan.
4. Name it `otaku-bazaar`, click **Create**, then **Connect** it to this project.
5. When asked which environments to connect:
   - Tick **Production**.
   - For **Preview**, turn on **"Create database branch for each preview deployment"** if it's offered. Each preview then gets its own copy of the data and can't damage your live database. If that option isn't shown, connect **Production only**.

Vercel adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED` for you. The build uses the unpooled one to update the database structure.

---

## Step 5: Add image storage (Vercel Blob)

1. **Storage** tab → **Create Database** → **Blob** → **Continue**.
2. Name it `otaku-bazaar-media`, click **Create**, and connect it to **Production** and **Preview**.

This adds `BLOB_READ_WRITE_TOKEN`, so photo uploads in the admin will now work.

---

## Step 6: Add the remaining settings

Go to **Settings → Environment Variables**. Add each row below, tick **Production** (and **Preview** where noted), then click **Save**.

| Name | Value | Required? |
|---|---|---|
| `AUTH_SECRET` | A long random password, **at least 32 characters**. Use a password manager's generator, or an online "random string" generator set to 48+ characters. Never share it. | **Yes** (Production + Preview) |
| `APP_URL` | Your site address with no trailing slash, e.g. `https://otaku-bazaar.vercel.app` or `https://theotakubazaar.com` | Yes (Production) |
| `BOOTSTRAP_ADMIN_EMAIL` | The email you'll use for the owner account. Remove it after Step 8. | Yes, temporarily |
| `SEED_DEMO_PRODUCTS` | `true` if you want the 84 demo products on first setup, so the site doesn't look empty while you add real products. Leave it out for an empty catalog. | Optional |
| `RESEND_API_KEY` | From Step 9 | Recommended |
| `MAIL_FROM` | e.g. `The Otaku Bazaar <orders@yourdomain.com>` | With Resend |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Step 10 | Optional |

**Never add `SEED_DEMO_ACCOUNTS`** on Vercel. Demo logins are for your own computer only, and the code refuses to create them on a hosted store anyway.

---

## Step 7: Deploy

1. Open the **Deployments** tab.
2. Click the **⋯** menu on the latest deployment and choose **Redeploy**.
3. Watch the build log. A correct build shows these lines in order:
   ```
   ▸ Generating Prisma client
   ▸ Applying database migrations (production)
   ▸ First-run setup check
   • First deploy: seeding base store data
   ▸ Building Next.js
   ```
   If you see `✔ Generated Prisma Client` followed straight by `▲ Next.js` **without** the "Applying database migrations" line, Vercel is using an old build command override. Clear it (see the note in Step 3) and redeploy.
4. When it says **Ready**, open `https://YOUR-SITE/api/health`. It should show `"status":"ok"`. Then click **Visit** to see the homepage.

On this first deploy, the store creates its roles and permissions, categories, anime list, shipping rates, homepage layout and policy page templates. It never overwrites anything you edit later.

---

## Step 8: Create your owner (Super Admin) account

1. On your new site, click **Sign in → Create an account** and register with **exactly** the email you put in `BOOTSTRAP_ADMIN_EMAIL`.
2. In Vercel, **Redeploy** again. The log will show `✓ you@… is now the first Super Admin`.
3. Sign out and back in on the site, then open **`/admin`**.
4. In Vercel, **delete** the `BOOTSTRAP_ADMIN_EMAIL` variable. It only ever works while the store has no Super Admin, but it's tidier to remove it.

To add staff later, have them register, then use **Admin → Staff & roles**.

---

## Step 9: Turn on emails (Resend)

Without this, customers won't receive verification or password-reset emails.

1. Sign up at **resend.com**.
2. **Domains → Add Domain**, enter your domain, and add the DNS records it shows at your domain registrar (GoDaddy, Hostinger, Namecheap and so on). Wait for **Verified**.
3. **API Keys → Create API Key** with **Sending access**, and copy it.
4. In Vercel, add `RESEND_API_KEY` (the key) and `MAIL_FROM` (an address on your verified domain), then **Redeploy**.

---

## Step 10: Google sign-in (optional)

1. Go to **console.cloud.google.com** and create a project.
2. **APIs & Services → OAuth consent screen**: choose External, fill in the app name, support email and your domain, then **Publish**.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Under **Authorised redirect URIs**, add `https://YOUR-DOMAIN/api/auth/google/callback`.
5. Copy the Client ID and Secret into Vercel as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then **Redeploy**.

The "Continue with Google" button appears automatically once these are set.

---

## Step 11: Use your own domain

1. Vercel → **Settings → Domains → Add**, then type `theotakubazaar.com` (or yours).
2. Add the DNS records Vercel shows at your registrar. HTTPS is set up automatically.
3. Update `APP_URL` to the new address and **Redeploy**.
4. If you use Google sign-in, add the new domain's callback URL in Google Cloud too.

---

## Step 12: Make the store yours (in `/admin`)

1. **Store settings:** store name, logo, announcement bar, support email and phone, social links, **Business details** (legal name, address, GSTIN) and **Grievance officer**.
2. **Pages & policies:** fill in every `[placeholder]`. Pages still needing work show a yellow dot. See [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md).
3. **Products:** add your real products and photos. If you seeded demo products, search "demo" and archive them.
4. **Homepage:** replace the demo banners with your artwork (1600×700 recommended).

---

## Everyday operation

- **Updating the site:** every change merged into `main` deploys automatically. Each pull request gets its own preview link.
- **Database changes** are applied automatically during each deploy.
- **Backups:** Neon keeps point-in-time history (the free tier keeps a short window; paid plans keep longer). Before big changes, create a manual **branch** of the database in the Neon console as a snapshot.
- **If a deploy breaks something:** Vercel → Deployments → pick the last good one → **⋯ → Promote to Production** (instant rollback).

## Troubleshooting

| Problem | Fix |
|---|---|
| Site shows "Finish setup to open it" | The page lists exactly which settings are missing. Fix them in Vercel and redeploy. |
| Build log shows `⚠ No database connected` | Do Step 4, then redeploy. |
| Site shows "Application error", and logs mention AUTH_SECRET | `AUTH_SECRET` is missing or shorter than 32 characters (Step 6). |
| Image upload says "Image storage is not set up" | Do Step 5, then redeploy. |
| No verification or password-reset emails arrive | Do Step 9. Check Resend → Logs. |
| `/admin` says "You don't have access" | Repeat Step 8 and make sure you signed out and back in. |
| Google button missing | `GOOGLE_CLIENT_ID` isn't set for that environment. |
| Build log has no "Applying database migrations" line | A dashboard Build Command override is set. Settings → Build and Deployment → turn off the override, then redeploy. |
| Build stops with "AUTH_SECRET is missing or shorter than 32 characters" | Add `AUTH_SECRET` for that environment (Production **and** Preview) in Step 6. |
| `/api/health` shows `migrations_missing` | The database wasn't updated. Check the build log for the migration step, then redeploy. |
| `/admin` dashboard shows "Launch setup" items | Each item links to its fix. Work through them before launch. |
| Build fails during "Applying database migrations" | Check the Neon database is connected, and that `DATABASE_URL_UNPOOLED` exists under Settings → Environment Variables. |
