import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { addItem, buildCartView, CartError, findActiveCart, getOrCreateCart, mergeGuestCartIntoUser, setItemQuantity } from "@/server/cart/service";
import { adjustStock } from "@/server/inventory/service";
import { makeProduct, makeUser } from "./helpers";

afterAll(() => db.$disconnect());

describe("cart", () => {
  it("adds items using database prices and rejects more than available stock", async () => {
    const { variants } = await makeProduct({ stock: [3], price: 79_900 });
    const { cart, newGuestToken } = await getOrCreateCart({});
    expect(newGuestToken).toBeTruthy();
    await addItem(cart.id, variants[0]!.id, 2);
    await expect(addItem(cart.id, variants[0]!.id, 2)).rejects.toThrow(CartError);
    const view = await buildCartView(await findActiveCart({ guestToken: newGuestToken }));
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]!.quantity).toBe(2);
    expect(view.subtotal).toBe(159_800);
  });

  it("never creates duplicate lines under concurrent adds", async () => {
    const { variants } = await makeProduct({ stock: [50] });
    const { cart } = await getOrCreateCart({});
    await Promise.allSettled(Array.from({ length: 5 }, () => addItem(cart.id, variants[0]!.id, 1)));
    const lines = await db.cartItem.findMany({ where: { cartId: cart.id } });
    expect(lines).toHaveLength(1);
  });

  it("refuses inactive or draft products and out-of-stock variants", async () => {
    const draft = await makeProduct({ status: "DRAFT" });
    const sold = await makeProduct({ stock: [0] });
    const { cart } = await getOrCreateCart({});
    await expect(addItem(cart.id, draft.variants[0]!.id, 1)).rejects.toThrow(/no longer available/);
    await expect(addItem(cart.id, sold.variants[0]!.id, 1)).rejects.toThrow(/out of stock/);
  });

  it("flags lines when stock drops after the item was added", async () => {
    const { variants } = await makeProduct({ stock: [5] });
    const { cart, newGuestToken } = await getOrCreateCart({});
    await addItem(cart.id, variants[0]!.id, 4);
    await adjustStock({ variantId: variants[0]!.id, delta: -3, reason: "DAMAGE" });
    const view = await buildCartView(await findActiveCart({ guestToken: newGuestToken }));
    expect(view.hasIssues).toBe(true);
    expect(view.lines[0]!.issue).toMatch(/Only 2 available/);
    const item = view.lines[0]!;
    await expect(setItemQuantity(cart.id, item.id, 3)).rejects.toThrow(/Only 2/);
    await setItemQuantity(cart.id, item.id, 2);
  });

  it("merges a guest cart into the user's cart on login", async () => {
    const user = await makeUser();
    const { variants } = await makeProduct({ stock: [10, 10] });
    const guest = await getOrCreateCart({});
    await addItem(guest.cart.id, variants[0]!.id, 2);
    await addItem(guest.cart.id, variants[1]!.id, 1);
    const mine = await getOrCreateCart({ userId: user.id });
    await addItem(mine.cart.id, variants[0]!.id, 1);

    await mergeGuestCartIntoUser(guest.newGuestToken!, user.id);
    const merged = await findActiveCart({ userId: user.id });
    const qty = Object.fromEntries(merged!.items.map((i) => [i.variantId, i.quantity]));
    expect(qty[variants[0]!.id]).toBe(3);
    expect(qty[variants[1]!.id]).toBe(1);
    expect((await db.cart.findUnique({ where: { id: guest.cart.id } }))!.status).toBe("MERGED");
  });
});
