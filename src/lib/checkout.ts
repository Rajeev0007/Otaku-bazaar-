// Shared (client + server) checkout schemas. The server always re-validates.
import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validation";

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Enter house / flat and street").max(160),
  line2: z.string().trim().max(160).optional().default(""),
  landmark: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2, "Enter the city").max(80),
  state: z.enum(INDIAN_STATES, { errorMap: () => ({ message: "Choose a state" }) }),
  postalCode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"),
  country: z.literal("IN").default("IN"),
  instructions: z.string().trim().max(300).optional().default(""),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const PAYMENT_METHODS = ["razorpay", "cod"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const checkoutSchema = z.object({
  email: emailSchema,
  phone: phoneSchema,
  shipping: addressSchema,
  billingSameAsShipping: z.boolean().default(true),
  billing: addressSchema.optional(),
  shippingMethod: z.string().max(40).default("standard"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  couponCode: z.string().trim().toUpperCase().max(40).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  saveAddress: z.boolean().default(false),
  marketingOptIn: z.boolean().default(false),
  idempotencyKey: z.string().min(16).max(64),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const quoteSchema = z.object({
  email: z.string().max(254).optional().default(""),
  postalCode: z.string().max(10).optional().default(""),
  shippingMethod: z.string().max(40).optional().default("standard"),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default("razorpay"),
  couponCode: z.string().trim().toUpperCase().max(40).optional().default(""),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PLACED: "Order placed",
  PAYMENT_CONFIRMED: "Payment confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELAYED: "Delayed",
  DELIVERY_FAILED: "Delivery failed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

/** Happy-path order of statuses, used for the tracking timeline. */
export const TIMELINE = ["PLACED", "PAYMENT_CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
