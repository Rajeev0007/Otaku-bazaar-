# Host The Otaku Bazaar on Vercel

**One setting is required: a database. Vercel adds it for you in one click.**
Everything else (email, Google sign-in, social links, business details, products, pages) is set up from the
store's **admin panel** after it's live. No environment variables to type.

---

## 1. Import the project (once)

1. Sign in at **vercel.com** with GitHub (account **Rajeev0007**).
2. **Add New → Project →** import **Otaku-bazaar-** → **Deploy**. Leave every setting as it is; `vercel.json` handles them.

> Reusing the old project? Settings → Build and Deployment → set **Framework Preset = Next.js** and turn **off** any Build/Install/Output overrides.

## 2. Connect the database (the only required step)

1. Your Vercel project → **Storage** → **Create Database** → **Neon** → Continue.
2. Region **Singapore**, plan **Free** → **Create** → **Connect** to the project (tick Production and Preview).
3. **Deployments** → ⋯ on the latest → **Redeploy**.

The build creates all store tables and default content, and prints a line like:

```
════════════════════════════════════════════════════
  OWNER SETUP CODE: ABCD-EF23
```

## 3. Create the owner account

1. Open your site. It shows **Store setup → Create the owner account**.
2. Copy the **OWNER SETUP CODE** from Vercel → Deployments → latest deployment → **Build Logs** (use the search box).
3. Enter the code, Satyam's name, email and a password → **Create owner account**.

You're taken to **/admin**. The setup code stops working once the owner exists.
Lost the code? Click **Generate a new code** on the setup page; it appears in Vercel → **Logs**.

## 4. Finish in the admin panel

The dashboard shows a **Launch setup** checklist. Each item links to the right screen:

| Admin page | What you set |
|---|---|
| **Integrations** | **Payments (Razorpay keys + webhook)**, email (Resend), Google sign-in, image storage status |
| **Orders** | Fulfil, mark shipped with tracking number, delivered, cancel and refund; invoices, packing slips, CSV export |
| **Coupons** | % off, ₹ off, free shipping, buy-1-get-1, with limits, dates and category/anime rules |
| **Store settings** | Store name, logo, announcement bar, owner, support email/phone/WhatsApp, **social links**, business details, grievance officer, shipping and tax display, maintenance mode, demo catalog on/off |
| **Pages & policies** | Terms, Privacy, Shipping, Returns, Cancellation, Payment, Grievance, Cookies, Disclaimer, IP, About, Contact |
| **Homepage** | Banners and the order of homepage sections |
| **Categories & anime** | Menu categories and anime collections |
| **Products / Inventory** | Your catalog, photos, variants and stock |
| **Customers, Reviews & Q&A, Newsletter** | Day-to-day operations, CSV exports |
| **Staff & roles** | Give team members access with limited permissions |

## Take payments

1. Cash on delivery works immediately (Store settings → Cash on delivery sets the limit and fee).
2. For UPI, cards, net banking and wallets: **Admin → Integrations → Payments**. Paste your Razorpay **test** Key ID and secret, add the webhook URL shown there in Razorpay with a secret, and save. Place a test order.
3. When Razorpay activates your account, replace them with **live** keys. The checkout shows "TEST MODE" until you do.

## Optional

- **Own domain:** Vercel → Settings → **Domains** → Add, then follow the DNS instructions. Links update automatically.
- **Faster images for big catalogs:** Vercel → Storage → Create → **Blob** → connect → redeploy. Until then, photos are stored in the database, which works fine for a small store.
- **Commercial use:** move to Vercel **Pro** once you start selling. The Hobby plan is for non-commercial use.

## Troubleshooting

| What you see | Fix |
|---|---|
| Setup page says "No database is connected" | Do step 2. |
| Setup page says "Redeploy to finish setup" | Deployments → ⋯ → Redeploy. |
| "That setup code is wrong or expired" | Use the code from the **latest** build log, or click "Generate a new code" and check Vercel → Logs. |
| "No entrypoint found" in the build | Framework Preset isn't Next.js (see the note in step 1). |
| Build log shows ✗ on migrations | Check the Neon database is connected to that environment, then redeploy. |
| Emails don't arrive | Admin → Integrations → Email → "Send me a test email". Your domain must be verified in Resend. |
| `/admin` says no access | Sign in with the owner email. |

Health check: `https://your-site/api/health` shows `"status":"ok"` when everything is connected.
