"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea, inputClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/store/product-image";
import { deleteProductAction, saveProductAction } from "@/app/admin/actions";
import { emptyVariant, type ProductFormValues, type VariantRow } from "@/components/admin/product-form-types";

type Option = { id: string; name: string };

export function ProductForm({ productId, initial, categories, franchises, brands, canDelete, storeUrl }: { productId: string | null; initial: ProductFormValues; categories: Option[]; franchises: Option[]; brands: Option[]; canDelete: boolean; storeUrl?: string }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const setVariant = (i: number, patch: Partial<VariantRow>) => setV((s) => ({ ...s, variants: s.variants.map((r, n) => (n === i ? { ...r, ...patch } : r)) }));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      [...files].forEach((f) => fd.append("file", f));
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      set("images", [...v.images, ...json.files.map((f: { url: string }) => ({ url: f.url, alt: v.name }))]);
    } catch (e) {
      toast({ tone: "error", title: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function generateMatrix() {
    const sizes = prompt("Sizes, comma separated (leave empty for none)", "S, M, L, XL, XXL");
    if (sizes === null) return;
    const colors = prompt("Colours, comma separated (leave empty for none)", "Black, Off White");
    if (colors === null) return;
    const sz = sizes.split(",").map((s) => s.trim()).filter(Boolean);
    const cl = colors.split(",").map((s) => s.trim()).filter(Boolean);
    const base = v.variants[0];
    const prefix = (base?.sku || v.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 16)).replace(/-+$/, "");
    const rows: VariantRow[] = [];
    for (const c of cl.length ? cl : [""]) for (const s of sz.length ? sz : [""]) {
      rows.push({ ...emptyVariant(), price: base?.price ?? "", compareAtPrice: base?.compareAtPrice ?? "", color: c, size: s, sku: [prefix, c.slice(0, 3).toUpperCase(), s].filter(Boolean).join("-") });
    }
    if (rows.length > 100) return toast({ tone: "error", title: "That would create more than 100 variants." });
    if (v.variants.some((r) => r.id) && !confirm("Replace the variant list? Existing variants not in the new list will be deactivated (kept for order history).")) return;
    set("variants", rows);
  }

  function submit(statusOverride?: string) {
    setErrors({});
    setFormError(null);
    const payload = {
      ...v,
      status: statusOverride ?? v.status,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      variants: v.variants.map((r) => ({ ...r, stock: r.id ? undefined : r.stock, compareAtPrice: r.compareAtPrice, costPrice: r.costPrice })),
    };
    start(async () => {
      const r = await saveProductAction(productId, payload);
      if (!r.ok) {
        setFormError(r.error);
        setErrors(r.fieldErrors ?? {});
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast({ title: r.message ?? "Saved" });
      if (!productId && r.data) router.replace(`/admin/products/${r.data.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!productId || !confirm("Delete this product? Products with orders are archived instead.")) return;
    start(async () => {
      const r = await deleteProductAction(productId);
      if (!r.ok) return toast({ tone: "error", title: r.error });
      toast({ title: r.message ?? "Deleted" });
      router.push("/admin/products");
    });
  }

  const err = (k: string) => errors[k];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <FormError message={formError} />
        <Section title="Details">
          <Field label="Name" htmlFor="name" error={err("name")}>
            <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={160} />
          </Field>
          <Field label="Subtitle" htmlFor="subtitle" hint="Short line under the title (optional).">
            <Input id="subtitle" value={v.subtitle} onChange={(e) => set("subtitle", e.target.value)} maxLength={200} />
          </Field>
          <Field label="Description" htmlFor="description" error={err("description")} hint="Supports ## headings, - lists, **bold**, _italic_ and [links](/url).">
            <Textarea id="description" rows={10} value={v.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
        </Section>

        <Section title="Media" description="First image is the main image. JPEG, PNG, WebP or AVIF up to 4 MB.">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {v.images.map((img, i) => (
              <div key={img.url + i} className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface-2">
                <ProductImage src={img.url} alt={img.alt} fill sizes="120px" className="object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-fg px-2 py-0.5 text-[0.6rem] font-semibold text-bg">Main</span>}
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition group-hover:opacity-100">
                  <button type="button" onClick={() => i > 0 && set("images", swap(v.images, i, i - 1))} className="glass grid h-7 w-7 place-items-center rounded-full" aria-label="Move left"><Icon name="chevron-left" size={14} /></button>
                  <button type="button" onClick={() => set("images", v.images.filter((_, n) => n !== i))} className="glass grid h-7 w-7 place-items-center rounded-full text-danger" aria-label="Remove image"><Icon name="trash" size={13} /></button>
                  <button type="button" onClick={() => i < v.images.length - 1 && set("images", swap(v.images, i, i + 1))} className="glass grid h-7 w-7 place-items-center rounded-full" aria-label="Move right"><Icon name="chevron-right" size={14} /></button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid aspect-[4/5] place-items-center rounded-xl border border-dashed border-line-strong text-sm text-muted hover:border-fg hover:text-fg">
              <span className="flex flex-col items-center gap-1.5">
                <Icon name="upload" size={20} /> {uploading ? "Uploading…" : "Upload"}
              </span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(e) => upload(e.target.files)} />
          <AddImageUrl onAdd={(url) => set("images", [...v.images, { url, alt: v.name }])} />
          {err("images") && <p className="text-xs text-danger">{err("images")}</p>}
          <Field label="Video URL" htmlFor="videoUrl" error={err("videoUrl")} hint="Optional MP4 hosted on your CDN (https://…).">
            <Input id="videoUrl" value={v.videoUrl} onChange={(e) => set("videoUrl", e.target.value)} placeholder="https://cdn.example.com/video.mp4" />
          </Field>
        </Section>

        <Section
          title="Variants, pricing & stock"
          description="Prices in rupees. Stock for existing variants is changed from Inventory so every change is logged."
          actions={
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={generateMatrix}>Generate size/colour matrix</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => set("variants", [...v.variants, emptyVariant()])}><Icon name="plus" size={14} /> Add variant</Button>
            </div>
          }
        >
          {err("variants") && <p className="text-sm text-danger">{err("variants")}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  {["SKU", "Size", "Colour", "Hex", "Model/style", "Price ₹", "Compare at ₹", "Cost ₹", "Stock", "Alert at", "Active", ""].map((h) => (
                    <th key={h} className="px-1.5 pb-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.variants.map((r, i) => (
                  <tr key={r.id ?? `new-${i}`} className={cn(!r.isActive && "opacity-50")}>
                    <Cell w="w-40" value={r.sku} onChange={(x) => setVariant(i, { sku: x })} error={err(`variants.${i}.sku`)} />
                    <Cell w="w-16" value={r.size} onChange={(x) => setVariant(i, { size: x })} />
                    <Cell w="w-24" value={r.color} onChange={(x) => setVariant(i, { color: x })} />
                    <td className="px-1.5 py-1"><input type="color" value={r.colorHex || "#000000"} onChange={(e) => setVariant(i, { colorHex: e.target.value })} className="h-9 w-10 cursor-pointer rounded-lg border border-line bg-transparent" aria-label="Colour swatch" /></td>
                    <Cell w="w-28" value={r.style} onChange={(x) => setVariant(i, { style: x })} />
                    <Cell w="w-24" value={r.price} onChange={(x) => setVariant(i, { price: x })} type="number" error={err(`variants.${i}.price`)} />
                    <Cell w="w-24" value={r.compareAtPrice} onChange={(x) => setVariant(i, { compareAtPrice: x })} type="number" error={err(`variants.${i}.compareAtPrice`)} />
                    <Cell w="w-20" value={r.costPrice} onChange={(x) => setVariant(i, { costPrice: x })} type="number" />
                    <td className="px-1.5 py-1">
                      {r.id ? <span className="block w-16 text-center tabular-nums text-muted" title="Change in Inventory">{r.onHand ?? 0}</span> : <input type="number" min={0} value={r.stock} onChange={(e) => setVariant(i, { stock: e.target.value })} className={cn(inputClass, "h-9 w-16 px-2")} aria-label="Initial stock" />}
                    </td>
                    <Cell w="w-16" value={r.lowStockThreshold} onChange={(x) => setVariant(i, { lowStockThreshold: x })} type="number" />
                    <td className="px-1.5 py-1 text-center"><input type="checkbox" checked={r.isActive} onChange={(e) => setVariant(i, { isActive: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" aria-label="Active" /></td>
                    <td className="px-1.5 py-1">
                      <button type="button" onClick={() => set("variants", v.variants.filter((_, n) => n !== i))} disabled={v.variants.length === 1} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-danger disabled:opacity-30" aria-label="Remove variant"><Icon name="trash" size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={v.variants.every((r) => r.allowBackorder)} onChange={(e) => set("variants", v.variants.map((r) => ({ ...r, allowBackorder: e.target.checked })))} className="h-4 w-4 accent-[var(--accent)]" />
            Allow orders when out of stock (pre-order / backorder)
          </label>
        </Section>

        <Section title="Specifications">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Material" htmlFor="material"><Input id="material" value={v.material} onChange={(e) => set("material", e.target.value)} /></Field>
            <Field label="Dimensions" htmlFor="dimensions"><Input id="dimensions" value={v.dimensions} onChange={(e) => set("dimensions", e.target.value)} /></Field>
            <Field label="Weight (grams)" htmlFor="weightGrams" error={err("weightGrams")} hint="Used for shipping rates."><Input id="weightGrams" type="number" value={v.weightGrams} onChange={(e) => set("weightGrams", e.target.value)} /></Field>
            <Field label="Warranty" htmlFor="warranty"><Input id="warranty" value={v.warranty} onChange={(e) => set("warranty", e.target.value)} placeholder="e.g. 6 months against manufacturing defects" /></Field>
          </div>
          <Field label="Care instructions" htmlFor="care"><Textarea id="care" rows={2} value={v.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} /></Field>
          <Field label="Authenticity / licensing" htmlFor="authenticity" hint="Shown to shoppers. State accurately whether this is licensed merchandise or an original design."><Textarea id="authenticity" rows={2} value={v.authenticity} onChange={(e) => set("authenticity", e.target.value)} /></Field>
        </Section>

        <Section title="Search engine listing">
          <Field label="URL slug" htmlFor="slug" hint={`/p/${v.slug || "generated-from-name"}`}><Input id="slug" value={v.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
          <Field label="Meta title" htmlFor="seoTitle" hint={`${v.seoTitle.length}/70`}><Input id="seoTitle" value={v.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={70} /></Field>
          <Field label="Meta description" htmlFor="seoDescription" hint={`${v.seoDescription.length}/170`}><Textarea id="seoDescription" rows={2} value={v.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={170} /></Field>
        </Section>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Section title="Status">
          <Select value={v.status} onChange={(e) => set("status", e.target.value)} aria-label="Status">
            <option value="DRAFT">Draft (hidden)</option>
            <option value="ACTIVE">Active (visible)</option>
            <option value="SCHEDULED">Scheduled launch</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          {(v.status === "SCHEDULED" || v.launchAt) && (
            <Field label="Launch date & time" htmlFor="launchAt" error={err("launchAt")} hint="Product becomes visible at this time (requires status Active or Scheduled).">
              <Input id="launchAt" type="datetime-local" suppressHydrationWarning value={isoToLocal(v.launchAt)} onChange={(e) => set("launchAt", e.target.value ? new Date(e.target.value).toISOString() : "")} />
            </Field>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => submit()} loading={pending} className="w-full">{productId ? "Save changes" : "Create product"}</Button>
            {storeUrl && v.status === "ACTIVE" && <a href={storeUrl} target="_blank" rel="noreferrer" className="text-center text-xs text-muted hover:text-fg">View in store ↗</a>}
            {productId && canDelete && <Button variant="danger" size="sm" onClick={remove} disabled={pending}>Delete product</Button>}
          </div>
        </Section>
        <Section title="Organisation">
          <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
            <Select id="categoryId" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Anime / franchise" htmlFor="franchiseId">
            <Select id="franchiseId" value={v.franchiseId} onChange={(e) => set("franchiseId", e.target.value)}>
              <option value="">None</option>
              {franchises.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Brand" htmlFor="brandId">
            <Select id="brandId" value={v.brandId} onChange={(e) => set("brandId", e.target.value)}>
              <option value="">None</option>
              {brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Product type" htmlFor="kind">
            <Select id="kind" value={v.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="STANDARD">Standard</option>
              <option value="BUNDLE">Bundle</option>
              <option value="MYSTERY_BOX">Mystery box</option>
              <option value="PRE_ORDER">Pre-order</option>
            </Select>
          </Field>
          <Field label="Tags" htmlFor="tags" hint="Comma separated. Used by search."><Input id="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
        </Section>
        <Section title="Merchandising">
          <Checkbox label="Featured" checked={v.isFeatured} onChange={(e) => set("isFeatured", e.currentTarget.checked)} />
          <Checkbox label="Limited edition" checked={v.isLimited} onChange={(e) => set("isLimited", e.currentTarget.checked)} />
          <Checkbox label="New arrival" checked={v.isNewArrival} onChange={(e) => set("isNewArrival", e.currentTarget.checked)} />
        </Section>
        <Section title="Returns">
          <Checkbox label="Returnable" checked={v.returnable} onChange={(e) => set("returnable", e.currentTarget.checked)} />
          <Field label="Return window (days)" htmlFor="returnWindowDays" hint="Leave empty to use the category default."><Input id="returnWindowDays" type="number" value={v.returnWindowDays} onChange={(e) => set("returnWindowDays", e.target.value)} /></Field>
        </Section>
      </div>
    </div>
  );
}

function isoToLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function swap<T>(arr: T[], a: number, b: number) {
  const c = [...arr];
  [c[a], c[b]] = [c[b]!, c[a]!];
  return c;
}

function Section({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Cell({ value, onChange, w, type = "text", error }: { value: string; onChange: (v: string) => void; w: string; type?: string; error?: string }) {
  return (
    <td className="px-1.5 py-1 align-top">
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "h-9 px-2", w, error && "border-danger")} title={error} step={type === "number" ? "any" : undefined} />
    </td>
  );
}

function AddImageUrl({ onAdd }: { onAdd: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="flex gap-2">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image URL (https:// or /path)" className="h-10" />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10"
        onClick={() => {
          if (url.startsWith("https://") || url.startsWith("/")) {
            onAdd(url);
            setUrl("");
          }
        }}
      >
        Add
      </Button>
    </div>
  );
}
