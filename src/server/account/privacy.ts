// Data portability and erasure (DPDP Act 2023 rights). Order records are kept for tax law but unlinked.
import { db } from "@/server/db";
import { pointsBalance } from "@/server/rewards/service";

export async function exportUserData(userId: string) {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      addresses: true,
      orders: { include: { items: true, events: { where: { isPublic: true } } } },
      reviews: true,
      wishlists: { include: { items: { include: { product: { select: { name: true, slug: true } } } } } },
      loyaltyLedger: true,
      tickets: { include: { messages: true } },
      sessions: { select: { createdAt: true, lastSeenAt: true, userAgent: true, ip: true } },
    },
  });
  const { passwordHash: _p, failedLogins: _f, lockedUntil: _l, ...profile } = u;
  return {
    exportedAt: new Date().toISOString(),
    notice: "Your personal data held by The Otaku Bazaar. Amounts are in paise (₹1 = 100).",
    profile: { id: profile.id, email: profile.email, name: profile.name, phone: profile.phone, createdAt: profile.createdAt, marketingOptIn: profile.marketingOptIn, emailVerifiedAt: profile.emailVerifiedAt },
    addresses: u.addresses,
    orders: u.orders.map((o) => ({ number: o.number, createdAt: o.createdAt, status: o.status, total: o.grandTotal, currency: o.currency, shippingAddress: o.shippingAddress, items: o.items.map((i) => ({ name: i.productName, option: i.variantTitle, quantity: i.quantity, total: i.total })), history: o.events.map((e) => ({ status: e.status, at: e.createdAt, message: e.message })) })),
    reviews: u.reviews.map((r) => ({ productId: r.productId, rating: r.rating, title: r.title, body: r.body, createdAt: r.createdAt })),
    wishlist: u.wishlists.flatMap((w) => w.items.map((i) => ({ product: i.product.name, addedAt: i.addedAt }))),
    rewardPoints: { balance: await pointsBalance(userId), history: u.loyaltyLedger },
    supportTickets: u.tickets.map((t) => ({ number: t.number, subject: t.subject, status: t.status, messages: t.messages.map((m) => ({ from: m.isStaff ? "store" : "you", body: m.body, at: m.createdAt })) })),
    signIns: u.sessions,
  };
}

export async function deleteAccount(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (u.isStaff) throw new Error("Staff accounts must have their roles removed by a Super Admin before deletion.");
  const placeholder = `deleted-${u.id}@deleted.invalid`;
  await db.$transaction([
    db.address.deleteMany({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }),
    db.oAuthAccount.deleteMany({ where: { userId } }),
    db.verificationToken.deleteMany({ where: { userId } }),
    db.wishlist.deleteMany({ where: { userId } }),
    db.cart.deleteMany({ where: { userId } }),
    db.stockAlert.deleteMany({ where: { OR: [{ userId }, { email: u.email }] } }),
    db.recentlyViewed.deleteMany({ where: { userId } }),
    db.searchQuery.updateMany({ where: { userId }, data: { userId: null } }),
    db.analyticsEvent.updateMany({ where: { userId }, data: { userId: null } }),
    // Support conversations are kept for the store's records but no longer identify the person.
    db.supportTicket.updateMany({ where: { OR: [{ userId }, { email: u.email }] }, data: { userId: null, email: placeholder, name: "Former customer" } }),
    db.review.updateMany({ where: { userId }, data: { authorName: "Former customer", userId: null } }),
    db.newsletterSubscriber.updateMany({ where: { email: u.email }, data: { unsubscribedAt: new Date() } }),
    // Orders stay for tax/accounting (see Privacy Policy) but are no longer linked to the account.
    db.order.updateMany({ where: { userId }, data: { userId: null } }),
    db.user.update({ where: { id: userId }, data: { email: placeholder, name: null, phone: null, passwordHash: null, avatarUrl: null, status: "DELETED", marketingOptIn: false, birthday: null, referralCode: null, tags: [] } }),
    db.auditLog.create({ data: { actorId: null, action: "account.deleted", entityType: "User", entityId: userId } }),
  ]);
}
