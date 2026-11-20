// Editable policy/info page TEMPLATES (Markdown), written for an Indian online store.
// Every [square-bracket placeholder] must be completed by the business, and the pages should be reviewed by a
// qualified lawyer before launch. Nothing here asserts real registrations, addresses or licences.
// Admins edit these in Admin → Pages & policies; pages with unfilled placeholders are flagged there.

const NOTICE =
  "> **Template — not legal advice.** Replace every [bracketed placeholder] and have this page reviewed by a qualified lawyer before launch.\n\n";

const UPDATED = "_Last updated: [DD Month YYYY]_\n\n";

export const POLICY_PAGES: { slug: string; title: string; kind: string; body: string }[] = [
  {
    slug: "about",
    title: "About Us",
    kind: "info",
    body: `${NOTICE}## Made by fans, for fans

The Otaku Bazaar is an online store for anime fans, collectors and gift shoppers. We curate apparel, accessories, wall art and collectibles inspired by the series we love, and we check every order before it ships.

## What we stand for

- **Quality first.** Every product is inspected before dispatch.
- **Honest pricing.** The price at checkout is the price you pay. No hidden fees.
- **Real support.** Talk to people who know anime. See [Contact Us](/pages/contact).

## Who we are

- Legal name: [Legal entity name, e.g. "XYZ Private Limited" or proprietor's name]
- Registered address: [Full registered address]
- GSTIN: [GSTIN]
- Customer care: [support email] · [support phone]
`,
  },
  {
    slug: "contact",
    title: "Contact Us",
    kind: "info",
    body: `## We're here to help

- **Email:** [support email]
- **Phone / WhatsApp:** [support phone]
- **Hours:** [Mon–Sat, 10:00–19:00 IST]
- **Address:** [Registered business address]

For anything about an order, please include your order number so we can help faster.

Complaints can also be raised with our Grievance Officer. See [Grievance Redressal](/pages/grievance-redressal).
`,
  },
  {
    slug: "terms",
    title: "Terms and Conditions",
    kind: "policy",
    body: `${NOTICE}${UPDATED}## 1. About these terms

These Terms and Conditions ("Terms") govern your use of [website domain] (the "Site") operated by **[Legal entity name]**, [registered address] ("we", "us", "our"). By browsing the Site, creating an account or placing an order, you agree to these Terms, our [Privacy Policy](/pages/privacy-policy), [Shipping Policy](/pages/shipping-policy), [Returns and Refund Policy](/pages/returns-policy) and [Cancellation Policy](/pages/cancellation-policy). If you do not agree, please do not use the Site.

## 2. Eligibility and accounts

- You must be at least 18 years old, or use the Site under the supervision of a parent or legal guardian who accepts these Terms.
- You are responsible for keeping your password confidential and for all activity on your account. Tell us immediately at [support email] if you suspect unauthorised use.
- Provide accurate information. We may suspend or close accounts that give false information, abuse promotions, or breach these Terms.

## 3. Products and descriptions

- We try to describe and photograph products accurately. Colours may vary slightly between screens, and handmade or printed items may have minor variations.
- Measurements and sizes are approximate. Please check the size guide on each product page.
- [State clearly whether products are officially licensed merchandise, original fan-inspired designs, or a mix, and how each is labelled on the product page.]

## 4. Prices and taxes

- All prices are in Indian Rupees (INR) and **include GST** unless stated otherwise.
- Shipping charges, if any, are shown before you pay.
- If a product is listed at an obviously incorrect price because of a technical or typographical error, we may cancel the order and refund you in full, even after confirmation.

## 5. Orders and contract formation

- Placing an order is an offer to buy. We accept it when we send a dispatch confirmation. We may decline or cancel an order (with a full refund) if an item is out of stock, if there is a pricing error, if we suspect fraud or resale abuse, or if we cannot deliver to your address.
- We may limit quantities per customer.

## 6. Payment

- Payments are processed by our payment partners ([Razorpay / Stripe / others]). We do not see or store your full card details.
- Cash on delivery, where offered, is subject to order value limits and may be unavailable for some PIN codes.
- See our [Payment Policy](/pages/payment-policy).

## 7. Shipping, cancellation and returns

Delivery timelines, cancellations, returns, exchanges and refunds are governed by our [Shipping Policy](/pages/shipping-policy), [Cancellation Policy](/pages/cancellation-policy) and [Returns and Refund Policy](/pages/returns-policy), which form part of these Terms.

## 8. Promotions, coupons, gift cards and reward points

- Coupons and offers are subject to their stated conditions, cannot be exchanged for cash, and may be withdrawn at any time without affecting orders already placed.
- [Gift card terms: validity period, non-refundability, no cash withdrawal.]
- [Loyalty/reward points terms, if any.]

## 9. Reviews and user content

By posting reviews, photos or questions you confirm the content is your own, truthful, and lawful, and you grant us a non-exclusive, royalty-free licence to display it on the Site and our social channels. We moderate content and may remove anything abusive, misleading, infringing or off-topic. Reviews are never edited to change their meaning. Only reviews linked to a confirmed order are marked "Verified purchase".

## 10. Acceptable use

You must not misuse the Site, including by: attempting unauthorised access; scraping, copying or reselling content; interfering with security or performance; placing fraudulent orders; or uploading malicious code or unlawful material.

## 11. Intellectual property

The Site's design, logo, text, graphics, and original product designs belong to [Legal entity name] or its licensors. Character names, series titles and related marks belong to their respective owners. Nothing on the Site grants you any licence to use them. See our [Copyright & IP Policy](/pages/intellectual-property).

## 12. Limitation of liability

To the extent permitted by law, our total liability for any claim relating to an order is limited to the amount you paid for that order. We are not liable for indirect or consequential losses, or for delays caused by events beyond our reasonable control (for example natural disasters, strikes, carrier disruptions or government action). Nothing in these Terms limits rights you have under the Consumer Protection Act, 2019 or other law that cannot be excluded.

## 13. Indemnity

You agree to indemnify us against claims arising from your breach of these Terms or misuse of the Site.

## 14. Privacy

How we collect and use personal data is explained in our [Privacy Policy](/pages/privacy-policy).

## 15. Grievances

Complaints are handled by our Grievance Officer as described on [Grievance Redressal](/pages/grievance-redressal).

## 16. Governing law and disputes

These Terms are governed by the laws of India. Subject to your rights as a consumer to approach the appropriate Consumer Commission, the courts at [City, State] have jurisdiction. We encourage you to contact us first so we can try to resolve any issue quickly.

## 17. Changes

We may update these Terms. The version in force when you place an order applies to that order. We will post the updated date above.

## 18. Contact

[Legal entity name] · [registered address] · [support email] · [support phone]
`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    kind: "policy",
    body: `${NOTICE}${UPDATED}This notice explains how **[Legal entity name]** ("we") processes your personal data when you use [website domain]. We act as a *Data Fiduciary* under India's Digital Personal Data Protection Act, 2023 ("DPDP Act") and its Rules. We also follow the Information Technology Act, 2000 and, for customers in the EU/UK, the GDPR where applicable.

## 1. Data we collect

| Category | Examples | Why |
|---|---|---|
| Account | name, email, phone, password (stored only as a one-way hash) | create and secure your account |
| Orders | delivery and billing addresses, items, order history, gift messages | fulfil and support orders, tax records |
| Payments | payment status and reference IDs from our payment partner | confirm payment, refunds, fraud prevention. **We never store full card numbers, CVV or UPI PINs.** |
| Support | messages, return requests, photos you upload | resolve your requests |
| Device & usage | IP address, browser, pages viewed, searches, cart activity | security, fraud prevention, improving the store |
| Marketing (optional) | email preferences | newsletters and offers, **only with your consent** |

We do not knowingly collect data from children under 18 without verifiable parental consent.

## 2. How we use it and our legal basis

- To perform our contract with you (orders, delivery, returns, support).
- To comply with law (tax and accounting records, responding to lawful requests).
- For legitimate uses permitted by law, such as preventing fraud and securing the Site.
- For marketing and non-essential analytics **only with your consent**, which you can withdraw at any time.

## 3. Who we share it with

Only as needed: payment processors ([Razorpay / Stripe]), courier and logistics partners ([Shiprocket / Delhivery / others]), email and SMS providers ([Resend / others]), hosting and database providers ([Vercel / Neon]), and professional advisers. They process data on our instructions under contracts. We may disclose data to authorities when required by law. **We do not sell your personal data.**

Some providers store data outside India. Where we transfer data abroad we do so only to countries not restricted by the Government of India, and with appropriate safeguards.

## 4. How long we keep it

- Account data: while your account is active, then deleted or anonymised within [N] days of a deletion request, unless we must keep it longer by law.
- Order and invoice records: [8] years for tax and accounting purposes.
- Security logs: [N] months.
- Marketing consent records: until you withdraw consent plus [N] months.

## 5. Your rights

Subject to the DPDP Act, you can:
- access a summary of your personal data and how it is processed;
- correct, complete or update it;
- have it erased when it's no longer needed (subject to legal retention);
- withdraw consent at any time (this doesn't affect processing done before withdrawal);
- nominate another person to exercise your rights in case of death or incapacity;
- raise a grievance with us, and if unresolved, with the Data Protection Board of India.

To exercise these rights, email [privacy contact email] or use your account settings. We respond within [N] days.

## 6. Security

We use encryption in transit (HTTPS), hashed passwords, hashed session and reset tokens, role-based staff access, audit logs, rate limiting and regular backups. No system is perfectly secure. If a personal data breach affects you, we will notify you and the Data Protection Board as required by law.

## 7. Cookies

We use essential cookies to keep you signed in and remember your cart. Analytics and marketing cookies are used only with your consent. See our [Cookie Policy](/pages/cookie-policy).

## 8. Contact and grievances

Privacy questions: [privacy contact email]
Grievance Officer: [Name], [Designation], [email], [phone]. See [Grievance Redressal](/pages/grievance-redressal).
`,
  },
  {
    slug: "grievance-redressal",
    title: "Grievance Redressal",
    kind: "policy",
    body: `${NOTICE}We want to resolve every issue quickly and fairly. In line with the Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000, we have appointed a Grievance Officer.

## Grievance Officer

- **Name:** [Full name]
- **Designation:** [Designation]
- **Email:** [grievance email]
- **Phone:** [phone number]
- **Address:** [Registered address]
- **Hours:** [Mon–Fri, 10:00–18:00 IST]

## How to raise a complaint

1. Email the Grievance Officer with your name, contact details, order number (if any) and a description of the issue. Attach photos if relevant.
2. We **acknowledge your complaint within 48 hours** and share a complaint reference number.
3. We aim to **resolve it within one month** of receipt and will keep you updated.

If you're not satisfied with our resolution, you can contact the National Consumer Helpline (dial 1915 or visit consumerhelpline.gov.in) or approach the appropriate Consumer Commission. For personal data complaints you may also approach the Data Protection Board of India.
`,
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    kind: "policy",
    body: `${NOTICE}${UPDATED}## Where we ship

We currently deliver across India via [courier partners]. [International shipping: not yet available / available to listed countries, see below.]

## Dispatch and delivery times

| Method | Typical delivery after dispatch | Charge |
|---|---|---|
| Standard | 4–7 business days | Free over ₹999, otherwise ₹49 |
| Express | 2–3 business days | ₹149 |
| Next-day | Metro cities only | ₹249 |

Orders are usually dispatched within [1–2] business days. Pre-order and made-to-order items show their own dispatch date on the product page. Use the PIN code checker on any product page for an estimate to your address. Remote areas may take longer.

## Charges

All shipping charges are shown at checkout before you pay. [Cash-on-delivery fee, if any.]

## Tracking

You'll get a tracking link by email/SMS once your order ships, and you can track it from your account.

## Failed delivery

If delivery fails after [3] attempts or the address is incorrect, the parcel is returned to us. We'll contact you to reship (shipping may be charged again) or refund the order value minus original shipping.

## Damaged or tampered parcels

Please refuse delivery if the package looks tampered with, or record an unboxing video and contact us within [48 hours] of delivery.

## International orders

[If offered: countries served, timelines, and that import duties and taxes are charged by the destination country and paid by the customer.]
`,
  },
  {
    slug: "returns-policy",
    title: "Returns and Refund Policy",
    kind: "policy",
    body: `${NOTICE}${UPDATED}## Return window

Most items can be returned within **[7] days of delivery** if they are unused and unwashed, with original tags and packaging. The window for each product is shown on its page.

## Items that can't be returned

Unless they arrive damaged, defective or wrong:
- mystery boxes and surprise items;
- opened manga and books;
- personalised or custom-made products;
- items marked "Non-returnable" on the product page.

**Figures and collectibles:** [3]-day window, for manufacturing defects or transit damage only. An unboxing video is strongly recommended.

## Damaged, defective or wrong items

Contact us within [48 hours] of delivery with photos or video. We'll arrange a free replacement or a full refund, including shipping.

## How to return

1. Go to **My account → Orders**, choose the order and select "Request return" (or email [support email] with your order number).
2. We review the request within [2] business days.
3. Once approved, we arrange a pickup where available, or ask you to self-ship. [Self-ship reimbursement policy.]

## Refunds

- Inspected and approved returns are refunded within **[5–7] business days** to the original payment method. Your bank may take a few more days to show it.
- Cash-on-delivery orders are refunded to [bank account via secure link / store credit, at your choice].
- Original shipping charges are refunded only for damaged, defective or wrong items.

## Exchanges

Size exchanges are free [once per order], subject to stock. If the new size is unavailable, we refund you instead.
`,
  },
  {
    slug: "cancellation-policy",
    title: "Cancellation Policy",
    kind: "policy",
    body: `${NOTICE}${UPDATED}- **Before dispatch:** cancel from **My account → Orders**, or email [support email]. Prepaid orders are refunded in full to the original payment method within [5–7] business days.
- **After dispatch:** the order can't be cancelled, but you can refuse delivery or request a return under our [Returns and Refund Policy](/pages/returns-policy).
- **Pre-orders:** can be cancelled for a full refund any time before dispatch.
- **Cancellation by us:** we may cancel an order if an item is out of stock, mispriced, undeliverable or flagged for fraud, and we'll refund you in full.

We do not charge a cancellation fee. [Change if you decide otherwise; it must be disclosed before purchase.]
`,
  },
  {
    slug: "payment-policy",
    title: "Payment Policy",
    kind: "policy",
    body: `${NOTICE}${UPDATED}## Accepted methods

- **India:** UPI, credit and debit cards, net banking and wallets via [Razorpay]. Cash on delivery for eligible orders [up to ₹X].
- **International:** cards [and Apple Pay / Google Pay / PayPal] via [Stripe], where available.

## Security

Payments are processed by PCI-DSS compliant payment partners. We never see or store your full card number, CVV or UPI PIN. Your payment page is served over an encrypted connection.

## Failed or duplicate payments

If money was debited but the order wasn't confirmed, it's normally reversed automatically by your bank or our payment partner within [5–7] business days. If not, email [support email] with the transaction reference.

## Invoices

A GST invoice is available from your account for every order.
`,
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    kind: "policy",
    body: `${NOTICE}${UPDATED}## Essential cookies (always on)

| Cookie | Purpose | Duration |
|---|---|---|
| ob_session | keeps you signed in (secure, http-only) | 30 days |
| ob_cart | remembers your cart when signed out | 60 days |
| ob_oauth | protects Google sign-in from forgery | 10 minutes |

We also store your theme choice, recent searches and recently viewed products in your browser's local storage. This data stays on your device.

## Analytics and marketing (optional)

[If enabled later: Google Analytics 4 and Meta Pixel load only after you consent, and you can change your choice at any time.]
`,
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    kind: "policy",
    body: `${NOTICE}All character names, series titles, logos and related marks belong to their respective owners and are used only to describe products. [Choose one and state it accurately: "Products marked *Official* are licensed merchandise sourced from authorised distributors." / "Our original designs are fan-inspired artwork and are not affiliated with or endorsed by the rights holders."]

Product images are for illustration. Actual products may vary slightly in colour and detail.
`,
  },
  {
    slug: "intellectual-property",
    title: "Copyright & Intellectual Property",
    kind: "policy",
    body: `${NOTICE}We respect intellectual property rights and expect our suppliers and users to do the same.

## Reporting infringement

If you own rights in a work and believe a product or content on this site infringes them, email [legal contact email] with:
1. your name, organisation and contact details;
2. a description of the work and proof of your rights;
3. the URL(s) of the listing(s) concerned;
4. a statement that the information is accurate and that you are the rights holder or authorised to act for them.

We acknowledge notices within [48 hours], review them promptly, and remove or disable infringing listings where appropriate.

## Our content

The site design, logo, photographs and original designs are owned by [Legal entity name]. Do not copy or reuse them without written permission.
`,
  },
];
