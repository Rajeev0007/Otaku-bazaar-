// Editable policy/info page TEMPLATES. Square-bracket placeholders must be completed by the business
// (ideally reviewed by a lawyer) before launch. Nothing here asserts real registrations or addresses.

const NOTICE = "> **Template:** replace every [bracketed placeholder] and review this page with a legal advisor before launch.\n\n";

export const POLICY_PAGES: { slug: string; title: string; kind: string; body: string }[] = [
  {
    slug: "about",
    title: "About Us",
    kind: "info",
    body: `${NOTICE}## Made by fans, for fans

The Otaku Bazaar is an anime merchandise store for collectors, casual fans and gift shoppers. We curate apparel, accessories, wall art and collectibles inspired by the series we love.

## What we stand for

- **Quality first.** Every product is checked before it ships.
- **Fair prices.** No hidden fees. What you see at checkout is what you pay.
- **Real support.** Talk to real people who know anime.

## Company details

- Legal business name: [Legal entity name]
- Registered address: [Registered address]
- GSTIN: [GSTIN, if registered]
`,
  },
  {
    slug: "contact",
    title: "Contact Us",
    kind: "info",
    body: `## We're here to help

- Email: [support email]
- Phone / WhatsApp: [support phone]
- Hours: [Mon–Sat, 10:00–19:00 IST]
- Address: [Business address]

For order questions, please include your order number.
`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    kind: "policy",
    body: `${NOTICE}_Last updated: [date]_

## Who we are
[Legal entity name] ("we") operates this website. Contact: [privacy contact email].

## What we collect
- Account details: name, email, phone, password (stored only as a one-way hash).
- Order details: shipping and billing addresses, items purchased.
- Payment details are processed by our payment partners ([Razorpay / Stripe]). We never store full card numbers.
- Usage data: pages viewed, searches, and device information, collected with your consent where required.

## Why we use it
To process orders, provide support, prevent fraud, improve the store, and—only with your consent—send marketing.

## Sharing
With payment processors, shipping carriers, email/SMS providers, and authorities where required by law. We do not sell personal data.

## Your rights
You can access, correct, export or delete your data from your account or by emailing [privacy contact email]. Applicable law: [e.g. India's Digital Personal Data Protection Act, 2023; GDPR for EU customers].

## Retention
[Describe retention periods, e.g. order records kept for tax purposes for N years.]

## Cookies
See our [Cookie Policy](/pages/cookie-policy).
`,
  },
  {
    slug: "terms",
    title: "Terms and Conditions",
    kind: "policy",
    body: `${NOTICE}_Last updated: [date]_

1. **Agreement.** By using this site you agree to these terms.
2. **Products & pricing.** We try to display products and prices accurately. If an error occurs we may cancel the affected order and refund you in full.
3. **Orders.** An order is accepted when we confirm dispatch. We may refuse orders suspected of fraud or resale abuse.
4. **Intellectual property.** [Describe the licensing status of designs and characters.]
5. **Liability.** [Limitation of liability clause.]
6. **Governing law.** [Jurisdiction, e.g. courts of [city], India.]
7. **Contact.** [support email]
`,
  },
  {
    slug: "shipping-policy",
    title: "Shipping Policy",
    kind: "policy",
    body: `${NOTICE}## Delivery times (India)
- Standard: 4–7 business days
- Express: 2–3 business days
- Next-day: metro cities only, orders before [cut-off time]

## Charges
Free standard shipping on orders over ₹999. Otherwise charges are shown at checkout before you pay.

## International
[Describe countries served, carriers, and that import duties may be charged on delivery.]

## Tracking
You'll get a tracking link by email and can track any order from your account.
`,
  },
  {
    slug: "returns-policy",
    title: "Returns and Refund Policy",
    kind: "policy",
    body: `${NOTICE}## Return window
Eligible items can be returned within **[7] days** of delivery in unused condition with tags and original packaging.

## Not returnable
Mystery boxes, opened manga, personalised items, and items marked non-returnable on the product page. Figures: [3]-day window for manufacturing defects only.

## Refunds
Approved refunds go to the original payment method within [5–7] business days of the return being received. COD orders are refunded to [bank account / store credit].

## Exchanges & replacements
Size exchanges are free once per order, subject to stock. Damaged or wrong items are replaced at no cost.
`,
  },
  {
    slug: "cancellation-policy",
    title: "Cancellation Policy",
    kind: "policy",
    body: `${NOTICE}You can cancel an order from your account any time before it is packed. Once shipped, please request a return instead. Prepaid cancellations are refunded in full to the original payment method within [5–7] business days.
`,
  },
  {
    slug: "cookie-policy",
    title: "Cookie Policy",
    kind: "policy",
    body: `${NOTICE}## Essential cookies
Used to keep you signed in, remember your cart and protect against fraud. These cannot be turned off.

## Analytics and marketing cookies
Used only with your consent, to understand how the store is used and to measure campaigns ([Google Analytics 4 / Meta Pixel]).
`,
  },
  {
    slug: "payment-policy",
    title: "Payment Policy",
    kind: "policy",
    body: `${NOTICE}We accept UPI, cards, net banking and wallets via [Razorpay] in India, and international cards via [Stripe]. Cash on delivery: [availability and limits]. Payments are processed by PCI-DSS compliant partners; we never see or store your full card number.
`,
  },
  {
    slug: "disclaimer",
    title: "Disclaimer",
    kind: "policy",
    body: `${NOTICE}All character names and series titles are trademarks of their respective owners. [State whether products are officially licensed, fan-inspired original designs, or a mix, and identify which.]
`,
  },
  {
    slug: "intellectual-property",
    title: "Copyright & Intellectual Property",
    kind: "policy",
    body: `${NOTICE}We respect intellectual property rights. If you believe content on this site infringes your rights, email [legal contact email] with the details and we will respond within [N] business days.
`,
  },
];
