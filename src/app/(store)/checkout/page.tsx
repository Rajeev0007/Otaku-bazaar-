import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCart } from "@/server/shopper";
import { getCurrentUser } from "@/server/auth/session";
import { buildQuote } from "@/server/checkout/pricing";
import { db } from "@/server/db";
import { getStoreSettings } from "@/server/settings";
import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const [cart, user, settings] = await Promise.all([getCurrentCart(), getCurrentUser(), getStoreSettings()]);
  const quote = await buildQuote(cart, { email: user?.email, userId: user?.id });
  if (!quote.lines.length) redirect("/cart");
  const addresses = user ? await db.address.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] }) : [];
  return (
    <div className="container-page pb-28 pt-6 lg:pb-16">
      <h1 className="mb-6 text-3xl font-semibold sm:text-4xl">Checkout</h1>
      <CheckoutClient
        initialQuote={quote}
        user={user ? { email: user.email, name: user.name, phone: user.phone } : null}
        addresses={addresses.map((a) => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 ?? "", landmark: a.landmark ?? "", city: a.city, state: a.state, postalCode: a.postalCode, instructions: a.instructions ?? "" }))}
        storeName={settings.name}
        giftMessage={cart?.giftMessage ?? null}
      />
    </div>
  );
}
