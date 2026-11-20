"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addItem, CartError, removeItem, setGiftOptions, setItemQuantity, setSavedForLater } from "@/server/cart/service";
import { cartItemCount, ensureCart } from "@/server/shopper";
import { enforceRateLimit, RateLimitError } from "@/server/security/rate-limit";
import { clientIp } from "@/server/request";

type CartResult = { ok: true; count: number; message?: string } | { ok: false; error: string };

const id = z.string().min(1).max(40);

async function run(fn: (cartId: string) => Promise<string | void>): Promise<CartResult> {
  try {
    await enforceRateLimit(`cart:${await clientIp()}`, 120, 60);
    const cart = await ensureCart();
    const message = await fn(cart.id);
    revalidatePath("/cart");
    return { ok: true, count: await cartItemCount(cart.id), message: message ?? undefined };
  } catch (err) {
    if (err instanceof CartError || err instanceof RateLimitError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: "Invalid request." };
    console.error("[cart]", err);
    return { ok: false, error: "Something went wrong updating your cart. Please try again." };
  }
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<CartResult> {
  return run(async (cartId) => {
    await addItem(cartId, id.parse(variantId), z.number().int().min(1).max(50).parse(quantity));
  });
}

export async function updateCartQuantityAction(itemId: string, quantity: number): Promise<CartResult> {
  return run(async (cartId) => {
    await setItemQuantity(cartId, id.parse(itemId), z.number().int().min(0).max(50).parse(quantity));
  });
}

export async function removeCartItemAction(itemId: string): Promise<CartResult> {
  return run(async (cartId) => {
    await removeItem(cartId, id.parse(itemId));
  });
}

export async function saveForLaterAction(itemId: string, saved: boolean): Promise<CartResult> {
  return run(async (cartId) => {
    await setSavedForLater(cartId, id.parse(itemId), z.boolean().parse(saved));
    return saved ? "Saved for later" : "Moved to cart";
  });
}

export async function setGiftOptionsAction(giftWrap: boolean, giftMessage: string): Promise<CartResult> {
  return run(async (cartId) => {
    await setGiftOptions(cartId, z.boolean().parse(giftWrap), z.string().max(300).parse(giftMessage));
    return "Gift options saved";
  });
}
