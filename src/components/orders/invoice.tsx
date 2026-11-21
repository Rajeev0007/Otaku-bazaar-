import type { Order, OrderItem } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import type { StoreSettings } from "@/server/settings";
import { PrintButton } from "@/components/orders/print-button";

type A = { fullName: string; line1: string; line2?: string; landmark?: string; city: string; state: string; postalCode: string; phone: string };

/** Printable tax invoice / packing slip. Uses a light layout regardless of site theme. */
export function Invoice({ order, items, settings, kind = "invoice" }: { order: Order; items: OrderItem[]; settings: StoreSettings; kind?: "invoice" | "packing" }) {
  const ship = order.shippingAddress as A;
  const bill = (order.billingAddress as A | null) ?? ship;
  const c = order.currency;
  const b = settings.business;
  return (
    <div className="min-h-dvh bg-white p-6 text-[13px] text-black sm:p-10 print:p-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-between gap-6 print:hidden">
          <p className="text-sm text-gray-500">Use your browser's print dialog to save as PDF.</p>
          <PrintButton />
        </div>
        <header className="flex justify-between gap-6 border-b border-gray-300 pb-4">
          <div>
            <p className="text-lg font-bold">{b.legalName || settings.name}</p>
            {b.address && <p className="text-gray-600">{b.address}</p>}
            {b.gstin && <p className="text-gray-600">GSTIN: {b.gstin}</p>}
            {settings.support.email && <p className="text-gray-600">{settings.support.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">{kind === "invoice" ? "Tax Invoice" : "Packing Slip"}</p>
            <p>No. {order.number}</p>
            <p>Date {(order.placedAt ?? order.createdAt).toLocaleDateString("en-IN")}</p>
            <p>Payment: {order.paymentMethod === "cod" ? "Cash on delivery" : order.paymentMethod === "giftcard" ? "Gift card" : "Prepaid"}</p>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-6 border-b border-gray-300 py-4">
          <div>
            <p className="font-semibold">Ship to</p>
            <p>{ship.fullName}<br />{[ship.line1, ship.line2, ship.landmark].filter(Boolean).join(", ")}<br />{ship.city}, {ship.state} {ship.postalCode}<br />{ship.phone}</p>
          </div>
          {kind === "invoice" && (
            <div>
              <p className="font-semibold">Bill to</p>
              <p>{bill.fullName}<br />{[bill.line1, bill.line2].filter(Boolean).join(", ")}<br />{bill.city}, {bill.state} {bill.postalCode}<br />{order.email}</p>
              <p className="mt-1 text-gray-600">Place of supply: {ship.state}</p>
            </div>
          )}
        </section>
        <table className="mt-4 w-full">
          <thead className="border-b border-gray-300 text-left">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">SKU</th>
              <th className="py-2 text-right">Qty</th>
              {kind === "invoice" && (
                <>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Discount</th>
                  <th className="py-2 text-right">Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-gray-200">
                <td className="py-2">{i.productName}{i.variantTitle !== "Default" && <span className="text-gray-600"> ({i.variantTitle})</span>}</td>
                <td className="py-2 font-mono text-xs">{i.sku}</td>
                <td className="py-2 text-right">{i.quantity}</td>
                {kind === "invoice" && (
                  <>
                    <td className="py-2 text-right">{formatMoney(i.unitPrice, c)}</td>
                    <td className="py-2 text-right">{i.discount ? `−${formatMoney(i.discount, c)}` : "—"}</td>
                    <td className="py-2 text-right">{formatMoney(i.total, c)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {kind === "invoice" ? (
          <dl className="ml-auto mt-4 w-72 space-y-1">
            <div className="flex justify-between"><dt>Items</dt><dd>{formatMoney(order.subtotal - order.discountTotal, c)}</dd></div>
            <div className="flex justify-between"><dt>Delivery</dt><dd>{formatMoney(order.shippingTotal, c)}</dd></div>
            {order.giftWrapTotal > 0 && <div className="flex justify-between"><dt>Gift wrap</dt><dd>{formatMoney(order.giftWrapTotal, c)}</dd></div>}
            {order.codFeeTotal > 0 && <div className="flex justify-between"><dt>COD fee</dt><dd>{formatMoney(order.codFeeTotal, c)}</dd></div>}
            {!order.taxInclusive && <div className="flex justify-between"><dt>{settings.taxLabel}</dt><dd>{formatMoney(order.taxTotal, c)}</dd></div>}
            {order.loyaltyTotal + order.giftCardTotal > 0 && <div className="flex justify-between border-t border-gray-300 pt-1"><dt>Invoice value</dt><dd>{formatMoney(order.grandTotal + order.loyaltyTotal + order.giftCardTotal, c)}</dd></div>}
            {order.loyaltyTotal > 0 && <div className="flex justify-between"><dt>Paid with reward points</dt><dd>−{formatMoney(order.loyaltyTotal, c)}</dd></div>}
            {order.giftCardTotal > 0 && <div className="flex justify-between"><dt>Paid with gift card</dt><dd>−{formatMoney(order.giftCardTotal, c)}</dd></div>}
            <div className="flex justify-between border-t border-gray-300 pt-1 text-base font-bold"><dt>{order.loyaltyTotal + order.giftCardTotal > 0 ? "Amount paid/due" : "Total"}</dt><dd>{formatMoney(order.grandTotal, c)}</dd></div>
            {order.taxInclusive && <p className="text-right text-xs text-gray-600">Includes {settings.taxLabel} of {formatMoney(order.taxTotal, c)} on goods</p>}
          </dl>
        ) : (
          order.giftMessage && <p className="mt-6 rounded border border-gray-300 p-3">Gift message: “{order.giftMessage}”</p>
        )}
        <p className="mt-10 text-center text-xs text-gray-500">
          {kind === "invoice" ? "This is a computer-generated invoice. HSN/SAC codes and GST split (CGST/SGST/IGST) should be confirmed with your accountant." : "Thank you for shopping with us!"}
        </p>
      </div>
    </div>
  );
}
