import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader, Table } from "@/components/admin/ui";
import { SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { saveCouponAction } from "@/app/admin/actions";
import type { Coupon } from "@prisma/client";
import { MultiSelectClient as MultiSelect } from "@/components/admin/multi-select";

export default async function CouponsAdmin({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff("marketing.write", "/admin/coupons");
  const { edit } = await searchParams;
  const [coupons, categories, franchises] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    db.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.animeFranchise.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const current = coupons.find((c) => c.id === edit) ?? null;
  const describe = (c: Coupon) => (c.type === "PERCENT" ? `${c.value}% off` : c.type === "FIXED" ? `${formatMoney(c.value, "INR")} off` : c.type === "FREE_SHIPPING" ? "Free shipping" : "Buy 1 get 1");
  const now = new Date();
  return (
    <>
      <PageHeader title="Coupons" description="Discount codes customers enter at checkout. Checked on the server every time." />
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Table head={["Code", "Offer", "Rules", "Used", "Status", ""]} empty={!coupons.length && <p className="p-6 text-center text-sm text-muted">No coupons yet. Create one on the right.</p>}>
          {coupons.map((c) => {
            const live = c.isActive && (!c.startsAt || c.startsAt <= now) && (!c.endsAt || c.endsAt > now) && (c.usageLimit === null || c.usedCount < c.usageLimit);
            return (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3">{describe(c)}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {[c.minSubtotal && `min ${formatMoney(c.minSubtotal, "INR")}`, c.maxDiscount && `max ${formatMoney(c.maxDiscount, "INR")}`, c.firstOrderOnly && "first order", c.perCustomerLimit && `${c.perCustomerLimit}/customer`, (c.categoryIds.length || c.franchiseIds.length) && "selected items", c.endsAt && `until ${c.endsAt.toLocaleDateString("en-IN")}`].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</td>
                <td className="px-4 py-3 text-xs">{live ? <span className="text-success">Live</span> : <span className="text-muted">Off</span>}</td>
                <td className="px-4 py-3"><a href={`/admin/coupons?edit=${c.id}`} className="text-xs text-accent hover:underline">Edit</a></td>
              </tr>
            );
          })}
        </Table>
        <Card title={current ? `Edit ${current.code}` : "New coupon"} actions={current && <a href="/admin/coupons" className="text-xs text-muted hover:text-fg">+ New</a>}>
          <SimpleForm key={current?.id ?? "new"} action={saveCouponAction} extra={{ id: current?.id }} className="grid gap-3 sm:grid-cols-2" resetOnSuccess={!current}>
            <Field label="Code" htmlFor="code"><Input id="code" name="code" defaultValue={current?.code} className="uppercase" required /></Field>
            <Field label="Type" htmlFor="type">
              <Select id="type" name="type" defaultValue={current?.type ?? "PERCENT"}>
                <option value="PERCENT">% off</option>
                <option value="FIXED">₹ off</option>
                <option value="FREE_SHIPPING">Free shipping</option>
                <option value="BOGO">Buy 1 get 1 free</option>
              </Select>
            </Field>
            <Field label="Value (% or ₹)" htmlFor="value" hint="Ignored for free shipping and BOGO"><Input id="value" name="value" type="number" step="any" defaultValue={current ? (current.type === "FIXED" ? current.value / 100 : current.value) : ""} /></Field>
            <Field label="Minimum cart (₹)" htmlFor="minSubtotal"><Input id="minSubtotal" name="minSubtotal" type="number" defaultValue={current ? current.minSubtotal / 100 : 0} /></Field>
            <Field label="Max discount (₹)" htmlFor="maxDiscount" hint="Cap for % and BOGO"><Input id="maxDiscount" name="maxDiscount" type="number" defaultValue={current?.maxDiscount ? current.maxDiscount / 100 : ""} /></Field>
            <Field label="Total uses allowed" htmlFor="usageLimit"><Input id="usageLimit" name="usageLimit" type="number" defaultValue={current?.usageLimit ?? ""} placeholder="unlimited" /></Field>
            <Field label="Uses per customer" htmlFor="perCustomerLimit"><Input id="perCustomerLimit" name="perCustomerLimit" type="number" defaultValue={current?.perCustomerLimit ?? ""} placeholder="unlimited" /></Field>
            <Field label="Description (internal)" htmlFor="description"><Input id="description" name="description" defaultValue={current?.description ?? ""} /></Field>
            <Field label="Starts" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocal(current?.startsAt)} /></Field>
            <Field label="Ends" htmlFor="endsAt"><Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocal(current?.endsAt)} /></Field>
            <Field label="Only for categories" htmlFor="categoryIds" className="sm:col-span-2" hint="Leave empty to apply to the whole store.">
              <MultiSelect id="categoryIds" name="categoryIds" options={categories} selected={current?.categoryIds ?? []} />
            </Field>
            <Field label="Only for anime" htmlFor="franchiseIds" className="sm:col-span-2">
              <MultiSelect id="franchiseIds" name="franchiseIds" options={franchises} selected={current?.franchiseIds ?? []} />
            </Field>
            <div className="flex gap-6 sm:col-span-2">
              <Checkbox name="firstOrderOnly" defaultChecked={current?.firstOrderOnly} label="First order only" />
              <Checkbox name="isActive" defaultChecked={current?.isActive ?? true} label="Active" />
            </div>
          </SimpleForm>
        </Card>
      </div>
    </>
  );
}

function toLocal(d?: Date | null) {
  return d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";
}
