# The Otaku Bazaar store

## Put it on Vercel (about 15 minutes)

1. **Upload to GitHub.** Create a new private repo on github.com, then upload the contents of this folder (drag and drop works: "Add file > Upload files"). Do not upload a `.env` file.
2. **Import to Vercel.** On vercel.com choose Add New > Project, pick the repo, leave every setting as it is, and click Deploy. The first deploy will load but the shop will say "Store is not set up yet". That is expected.
3. **Add the database (free).** In your Vercel project open Storage > Create Database (or Marketplace) > **Upstash Redis**, pick the free plan and connect it to this project. Vercel fills in the database settings for you.
4. **Add your settings.** Project > Settings > Environment Variables, add:
   - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (start with test keys)
   - `ADMIN_KEY` (a long password only you know; it opens /admin.html)
   - `RAZORPAY_WEBHOOK_SECRET` (any long random text, used in step 6)
   - Optional emails: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `OWNER_EMAIL` (Gmail needs an App Password)
5. **Redeploy.** Deployments > the latest one > Redeploy. Open your site and try a test order.
6. **Razorpay webhook.** Razorpay Dashboard > Settings > Webhooks > Add: URL `https://YOUR-SITE.vercel.app/api/webhook`, secret = the `RAZORPAY_WEBHOOK_SECRET` from step 4, event `payment.captured`. This confirms orders even if a customer closes the page right after paying.
7. **Go live.** After Razorpay activates your account, replace the test keys with live keys and redeploy. Optionally add your own domain in Vercel > Settings > Domains.

Orders and reviews live in Upstash Redis, not in files. Manage orders at `/admin.html`.

**Razorpay setting that matters:** in Razorpay Dashboard > Settings > Payment Capture, choose **Automatic**. With manual capture, payments are refunded after a few days and the webhook never fires.

## Change your products
Edit `products.json` in GitHub (the shop checks it on load and tells you exactly what is wrong if a price, id or colour is invalid) (pencil icon) and commit; Vercel redeploys automatically. Fields: name, category (`cat`), price in whole rupees, tile colour (`c`), `desc`, photos `"imgs":["/photo1.jpg"]` (upload photo files into the `public` folder). Shipping, free-shipping amount and the top banner are in the same file. Coupons are in `coupons.json` (`percent`, `flat`, `freeship`; `min` is the minimum cart).

## Run on your own computer
Node 20+. Copy `.env.example` to `.env`, fill in the Razorpay and admin lines, run `node server.js`, open http://localhost:3000. Orders are saved in local files. `npm test` runs the automated checks against both storage types.

## Built-in protection
Prices and coupons are recalculated on the server. Payments count only with a valid Razorpay signature. Tracking and reviews need the order ID plus the phone number. Reviews are limited to paying customers. Login and lookups are rate-limited.
