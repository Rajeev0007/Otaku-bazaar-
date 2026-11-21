# Launch checklist: business, legal and compliance (India)

> This is a practical checklist, **not legal advice**. Laws change (for example, the Consumer Protection (E-Commerce) Rules were amended in 2026 and the DPDP Rules are phasing in). Have a Chartered Accountant and a lawyer review your setup before you start selling.

## 1. Business registration and tax

- [ ] **Choose a business structure:** sole proprietorship, LLP, or private limited company. Payment gateways need one of these with a matching bank account.
- [ ] **GST registration.** It's required once turnover crosses the threshold, and in specific cases such as inter-state supplies or selling through marketplaces. Even below the threshold, payment gateways and couriers usually ask for a GSTIN, and selling to customers in other states typically needs one. Confirm with your CA before you start selling.
- [ ] **Current (business) bank account** in the business name.
- [ ] **PAN** for the business, and **Udyam (MSME) registration** (free, optional, useful for benefits).
- [ ] **Shops & Establishments** registration if your state requires it for your premises.
- [ ] Use your CA's guidance on the **HSN codes and GST rates** for each product type. Apparel, posters, figures and accessories carry different rates. The store currently shows prices as GST-inclusive at one rate (Admin → Store settings); per-category rates come with checkout.

## 2. Mandatory information on the website (Consumer Protection (E-Commerce) Rules, 2020)

The admin has fields for each of these. Fill them in Admin → Store settings and Admin → Pages & policies.

- [ ] **Legal name** of the business, **registered address**, and **customer care** email and phone (footer and Contact page).
- [ ] **Grievance Officer** name, designation and contact details. Complaints must be acknowledged within **48 hours** and resolved within **one month** (Grievance Redressal page).
- [ ] **Return, refund, exchange, warranty, delivery and shipment** terms (Returns, Shipping and Cancellation pages).
- [ ] **Payment methods** and their security (Payment Policy page).
- [ ] **Total price including all charges** shown before payment. The checkout will show this (Phase 4).
- [ ] **Country of origin** for each product. Add it in Admin → Products → Specifications, for example in "Material" or the description. A dedicated field comes with Phase 4.
- [ ] **No fake reviews.** The demo reviews are marked as not verified and **must be deleted before launch**.
- [ ] **No dark patterns:** no fake urgency, no drip pricing, no pre-ticked add-ons. The store avoids these by design. Keep it that way when adding promotions.

## 3. Policy pages (templates are already in the store)

Fill every `[placeholder]` in **Admin → Pages & policies**. Pages with unfilled placeholders show a yellow dot.

- [ ] Terms and Conditions
- [ ] Privacy Policy (written for the DPDP Act 2023; most of its business duties start **13 May 2027**, but follow them now)
- [ ] Shipping Policy
- [ ] Returns and Refund Policy
- [ ] Cancellation Policy
- [ ] Payment Policy
- [ ] Grievance Redressal
- [ ] Cookie Policy
- [ ] Disclaimer
- [ ] Copyright & Intellectual Property
- [ ] About Us and Contact Us

**Razorpay and Stripe review these pages before activating your account.** They typically check for Contact Us, Terms, Privacy, Refund/Cancellation and Shipping pages, plus business details that match your KYC.

## 4. Intellectual property (important for anime merchandise)

This is the biggest legal risk for an anime merch store.

- [ ] Character names, artwork and logos from anime series are owned by their studios and publishers. Selling products that use them **without a licence** can lead to takedowns, account bans with payment gateways or marketplaces, and legal claims.
- [ ] For each product, know whether it is:
  - **officially licensed:** bought from an authorised distributor, with invoices to prove it, or
  - an **original design:** your own artwork that doesn't copy protected characters or logos, or
  - **fan art of protected characters:** high risk. Get legal advice or avoid it.
- [ ] Fill in the **Authenticity / licensing** field on every product accurately. It's shown to shoppers.
- [ ] Choose the correct wording in the **Disclaimer** page.
- [ ] Consider registering **"The Otaku Bazaar"** as a trademark (Class 25 apparel, Class 35 retail services). Search the IP India database first.
- [ ] Keep supplier invoices and licence documents organised. Marketplaces and payment providers may ask for them.

## 5. Payments (before you accept real orders)

- [ ] **Razorpay:** create an account, complete KYC (business PAN, GST, bank account, address proof), and add the live website URL with the policy pages.
- [ ] Use **test mode** first. The store won't claim payments are live until real keys are configured.
- [ ] Set **automatic payment capture**.
- [ ] Decide on **cash on delivery** limits and whether to charge a COD fee (it must be shown before checkout).
- [ ] For international sales: a **Stripe** account (India-based businesses need an export/international payments setup), and an understanding of the GST rules on exports (LUT filing).

## 6. Shipping

- [ ] Choose a courier aggregator (**Shiprocket** is built in) and complete its KYC. Book one real test shipment before launch.
- [ ] Confirm real rates and delivery times, then update the shipping zones (the PIN code checker uses them) and the Shipping Policy.
- [ ] Decide how you'll handle packaging, COD remittance cycles and returns.

## 7. Privacy and data (DPDP Act 2023 and Rules 2025)

- [ ] Name a person responsible for privacy and add their contact to the Privacy Policy.
- [ ] Marketing emails only with opt-in consent. The newsletter and signup forms already require it.
- [ ] Keep a simple record of which service providers hold customer data (Vercel, Neon, Resend, the payment gateway, couriers).
- [ ] Have a breach response plan (see [SECURITY.md](../SECURITY.md)).
- [ ] Decide retention periods and write them in the Privacy Policy.
- [ ] Customers can download their data and delete their account from My account. Mention this in the Privacy Policy, along with how long order and support records are kept after deletion.
- [ ] If you add Google Analytics or Meta Pixel, list them in the Cookie Policy. The store asks for consent before loading them.
- [ ] Gift cards and reward points: write their terms (validity, no cash refund, what happens on returns) in the Terms & Conditions before you sell or issue them.

## 8. Before you switch DNS to the new store

- [ ] All of sections 1–3 done, and the IP review in section 4 done.
- [ ] Phase 4 (checkout and payments) merged and tested with test payments.
- [ ] Demo products and demo reviews removed; real products, photos and prices added.
- [ ] Owner and staff accounts set up with the right roles, with two-factor authentication on every service account ([SECURITY.md](../SECURITY.md)).
- [ ] A test order placed end-to-end on the live domain.
- [ ] Google Search Console set up with `/sitemap.xml` submitted.
