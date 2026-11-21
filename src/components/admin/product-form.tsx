"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea, inputClass } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ProductImage } from "@/components/store/product-image";
import { deleteProductAction, duplicateProductAction, saveProductAction } from "@/app/admin/actions";
import { emptyVariant, variantKey, type ProductFormValues, type VariantRow } from "@/components/admin/product-form-types";
import { prepareImage } from "@/components/admin/image-resize";

const compactInput = inputClass.replace("w-full ", "");

type Option = { id: string; name: string };

const SIZE_PRESETS = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const PRINT_SIZES = ["A4", "A3", "A2"];
const COLOR_PRESETS = [
  { name: "Black", hex: "#111114" },
  { name: "White", hex: "#f5f5f5" },
  { name: "Off White", hex: "#ece9e2" },
  { name: "Grey", hex: "#8a8a92" },
  { name: "Charcoal", hex: "#3a3a40" },
  { name: "Navy", hex: "#1c2541" },
  { name: "Maroon", hex: "#5c1a22" },
  { name: "Red", hex: "#d62839" },
  { name: "Pink", hex: "#f4a6c0" },
  { name: "Purple", hex: "#6c5ce7" },
  { name: "Green", hex: "#2f7a4d" },
  { name: "Beige", hex: "#d8c3a5" },
];
const MODEL_PRESETS = ["iPhone 15", "iPhone 16", "iPhone 16 Pro", "Galaxy S24", "Pixel 9", "OnePlus 12"];

export function ProductForm({ productId, initial, categories, franchises, brands, canDelete, storeUrl }: { productId: string | null; initial: ProductFormValues; categories: Option[]; franchises: Option[]; brands: Option[]; canDelete: boolean; storeUrl?: string }) {
  const [v, setV] = useState(initial);
  const hasAttrs = initial.sizes.length + initial.colors.length + initial.styles.length > 0;
  const [withOptions, setWithOptions] = useState(hasAttrs);
  const [rows, setRows] = useState<Map<string, VariantRow>>(() => new Map(initial.variants.map((r) => [variantKey(r), r])));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const text = (k: keyof ProductFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(k, e.target.value as never);

  // Every combination of the chosen colours × sizes × models.
  const combos = useMemo(() => {
    if (!withOptions) return [{ color: "", size: "", style: "" }];
    const cs = v.colors.length ? v.colors.map((c) => c.name) : [""];
    const ss = v.sizes.length ? v.sizes : [""];
    const ms = v.styles.length ? v.styles : [""];
    return cs.flatMap((color) => ss.flatMap((size) => ms.map((style) => ({ color, size, style }))));
  }, [withOptions, v.colors, v.sizes, v.styles]);

  const variants: VariantRow[] = combos.map((c) => {
    const key = variantKey(c);
    const existing = rows.get(key) ?? (combos.length === 1 && !withOptions ? [...rows.values()][0] : undefined);
    return { ...(existing ?? emptyVariant()), ...c, colorHex: v.colors.find((x) => x.name === c.color)?.hex ?? "" };
  });
  const updateRow = (r: VariantRow, patch: Partial<VariantRow>) => setRows((m) => new Map(m).set(variantKey(r), { ...r, ...patch }));

  async function upload(files: FileList | File[] | null) {
    const list = files ? [...files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)) : [];
    if (!list.length) return;
    setUploading(list.length);
    try {
      const fd = new FormData();
      for (const f of list) fd.append("file", await prepareImage(f));
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setV((s) => ({ ...s, images: [...s.images, ...json.files.map((f: { url: string }) => ({ url: f.url, alt: "" }))] }));
    } catch (e) {
      toast({ tone: "error", title: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setUploading(0);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function moveImage(i: number, to: number) {
    setV((s) => {
      const imgs = [...s.images];
      const [img] = imgs.splice(i, 1);
      imgs.splice(to, 0, img!);
      return { ...s, images: imgs };
    });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = "Enter the product name";
    if (!v.categoryId) e.categoryId = "Choose a category";
    const needsMain = variants.some((r) => r.isActive && !r.price);
    if (needsMain && !(Number(v.price) > 0)) e.price = "Enter the price";
    if (v.compareAtPrice && Number(v.compareAtPrice) <= Number(v.price)) e.compareAtPrice = "Must be higher than the price (or leave empty)";
    if (withOptions && combos.length === 1 && !combos[0]!.color && !combos[0]!.size && !combos[0]!.style) e.options = "Pick at least one size, colour or model, or switch to “One option”";
    if (!variants.some((r) => r.isActive)) e.options = "Turn on at least one option";
    if (variants.length > 100) e.options = "That's more than 100 combinations. Remove a few sizes or colours.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save(status?: string) {
    setFormError(null);
    if (!validate()) {
      setFormError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const payload = {
      ...v,
      status: status ?? v.status,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      variants: variants.map((r) => ({
        id: r.id,
        sku: r.sku,
        size: r.size,
        color: r.color,
        colorHex: r.colorHex,
        style: r.style,
        price: r.price || v.price,
        compareAtPrice: r.price ? r.compareAtPrice : r.compareAtPrice || v.compareAtPrice,
        costPrice: r.costPrice,
        stock: r.stock === "" ? (r.id ? undefined : 0) : Number(r.stock),
        lowStockThreshold: v.lowStockThreshold || 5,
        allowBackorder: v.allowBackorder,
        isActive: r.isActive,
      })),
    };
    start(async () => {
      const r = await saveProductAction(productId, payload);
      if (!r.ok) {
        setFormError(r.fieldErrors ? `${r.error} ${Object.values(r.fieldErrors).join(" · ")}` : r.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      toast({ title: r.message ?? "Saved", action: r.data ? { label: "View", href: `/p/${r.data.slug}` } : undefined });
      if (!productId && r.data) router.replace(`/admin/products/${r.data.id}`);
      else router.refresh();
    });
  }

  const totalStock = variants.filter((r) => r.isActive).reduce((n, r) => n + (Number(r.stock) || 0), 0);
  const card = "rounded-2xl border border-line bg-surface p-4 sm:p-5";

  return (
    <div className="pb-28">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <FormError message={formError} />

          {/* Photos */}
          <section className={card}>
            <SectionTitle n={1} title="Photos" hint="First photo is the main one. Big phone photos are shrunk automatically." />
            <div
              onDragOver={(e) => (e.preventDefault(), setDragOver(true))}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                upload(e.dataTransfer.files);
              }}
              className={cn("grid grid-cols-3 gap-2 rounded-2xl sm:grid-cols-4 lg:grid-cols-5", dragOver && "ring-2 ring-accent")}
            >
              {v.images.map((img, i) => (
                <div key={img.url + i} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
                  <ProductImage src={img.url} alt="" fill sizes="160px" className="object-cover" />
                  {i === 0 ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-fg px-2 py-0.5 text-[0.6rem] font-semibold text-bg">Main</span>
                  ) : (
                    <button type="button" onClick={() => moveImage(i, 0)} className="glass absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold">Make main</button>
                  )}
                  <div className="absolute inset-x-1 bottom-1 flex justify-between">
                    <button type="button" disabled={i === 0} onClick={() => moveImage(i, i - 1)} className="glass grid h-8 w-8 place-items-center rounded-full disabled:opacity-0" aria-label="Move left"><Icon name="chevron-left" size={14} /></button>
                    <button type="button" onClick={() => set("images", v.images.filter((_, n) => n !== i))} className="glass grid h-8 w-8 place-items-center rounded-full text-danger" aria-label="Remove photo"><Icon name="trash" size={14} /></button>
                    <button type="button" disabled={i === v.images.length - 1} onClick={() => moveImage(i, i + 1)} className="glass grid h-8 w-8 place-items-center rounded-full disabled:opacity-0" aria-label="Move right"><Icon name="chevron-right" size={14} /></button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={!!uploading} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-line-strong text-sm text-muted transition hover:border-accent hover:text-fg">
                <span className="flex flex-col items-center gap-1.5 px-2 text-center">
                  {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" /> : <Icon name="upload" size={22} />}
                  <span className="text-xs font-medium">{uploading ? `Uploading ${uploading}…` : v.images.length ? "Add more" : "Add photos"}</span>
                  {!uploading && !v.images.length && <span className="hidden text-[0.65rem] text-subtle sm:block">or drag &amp; drop</span>}
                </span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
          </section>

          {/* Basics */}
          <section className={card}>
            <SectionTitle n={2} title="Basics" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name" htmlFor="name" error={errors.name} className="sm:col-span-2">
                <Input id="name" value={v.name} onChange={text("name")} maxLength={160} placeholder="e.g. Naruto Akatsuki Oversized Hoodie" invalid={!!errors.name} />
              </Field>
              <Field label="Category" htmlFor="categoryId" error={errors.categoryId}>
                <Select id="categoryId" value={v.categoryId} onChange={text("categoryId")} aria-invalid={!!errors.categoryId}>
                  <option value="">Choose…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Anime / series" htmlFor="franchiseId">
                <Select id="franchiseId" value={v.franchiseId} onChange={text("franchiseId")}>
                  <option value="">None</option>
                  {franchises.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Description" htmlFor="description" hint="Tip: start new lines with “- ” for bullet points." className="sm:col-span-2">
                <Textarea id="description" rows={5} value={v.description} onChange={text("description")} placeholder="What it is, why fans will love it, fit and material…" />
              </Field>
            </div>
          </section>

          {/* Price & stock */}
          <section className={card}>
            <SectionTitle n={3} title="Price & stock" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Price (₹)" htmlFor="price" error={errors.price}>
                <Input id="price" type="number" inputMode="decimal" min={0} value={v.price} onChange={text("price")} placeholder="999" invalid={!!errors.price} />
              </Field>
              <Field label="MRP / was (₹)" htmlFor="compareAtPrice" error={errors.compareAtPrice} hint="Optional. Shows a discount.">
                <Input id="compareAtPrice" type="number" inputMode="decimal" min={0} value={v.compareAtPrice} onChange={text("compareAtPrice")} placeholder="1299" />
              </Field>
              {!withOptions && (
                <Field label="Stock" htmlFor="stock-single" hint={variants[0]?.reserved ? `${variants[0].reserved} held by unpaid orders` : "Units you have"}>
                  <Input id="stock-single" type="number" inputMode="numeric" min={0} value={variants[0]?.stock ?? ""} onChange={(e) => updateRow(variants[0]!, { stock: e.target.value })} placeholder="0" />
                </Field>
              )}
            </div>
            {Number(v.compareAtPrice) > Number(v.price) && Number(v.price) > 0 && (
              <p className="mt-2 text-xs font-medium text-success">Customers see {Math.round((1 - Number(v.price) / Number(v.compareAtPrice)) * 100)}% off</p>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <ModeButton active={!withOptions} onClick={() => setWithOptions(false)} title="One option" desc="e.g. a poster, figure, keychain" />
              <ModeButton active={withOptions} onClick={() => setWithOptions(true)} title="Sizes / colours" desc="e.g. T-shirts, hoodies, phone cases" />
            </div>

            {withOptions && (
              <div className="mt-5 space-y-5">
                <ChipPicker label="Sizes" values={v.sizes} onChange={(x) => set("sizes", x)} presets={SIZE_PRESETS} extraPresets={PRINT_SIZES} placeholder="Other size, e.g. 28" />
                <ColorPicker values={v.colors} onChange={(x) => set("colors", x)} />
                <ChipPicker label="Model / style (optional)" values={v.styles} onChange={(x) => set("styles", x)} presets={MODEL_PRESETS} placeholder="e.g. iPhone 15 Pro Max" />
                {errors.options && <p className="text-sm text-danger">{errors.options}</p>}

                {combos.some((c) => c.color || c.size || c.style) && (
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{variants.length} option{variants.length === 1 ? "" : "s"} · {totalStock} in stock</p>
                      <BulkStock onApply={(n) => setRows((m) => { const next = new Map(m); for (const r of variants) next.set(variantKey(r), { ...r, stock: n }); return next; })} />
                    </div>
                    <ul className="divide-y divide-line rounded-xl border border-line">
                      {variants.map((r) => (
                        <li key={variantKey(r)} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 p-3", !r.isActive && "opacity-50")}>
                          <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                            {r.colorHex && <span className="h-4 w-4 shrink-0 rounded-full border border-line-strong" style={{ background: r.colorHex }} />}
                            <span className="truncate">{[r.color, r.size, r.style].filter(Boolean).join(" / ")}</span>
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-muted">
                            Stock
                            <input type="number" inputMode="numeric" min={0} value={r.stock} onChange={(e) => updateRow(r, { stock: e.target.value })} placeholder="0" className={cn(compactInput, "h-9 w-20 px-2")} aria-label={`Stock for ${[r.color, r.size, r.style].filter(Boolean).join(" ")}`} />
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted">
                            ₹
                            <input type="number" inputMode="decimal" min={0} value={r.price} onChange={(e) => updateRow(r, { price: e.target.value })} placeholder={v.price || "price"} className={cn(compactInput, "h-9 w-24 px-2")} aria-label="Price for this option (optional)" />
                          </label>
                          <button type="button" onClick={() => updateRow(r, { isActive: !r.isActive })} className={cn("h-9 rounded-full px-3 text-xs font-medium", r.isActive ? "bg-success/15 text-success" : "bg-surface-3 text-muted")} aria-pressed={r.isActive}>
                            {r.isActive ? "On" : "Off"}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted">Leave the ₹ box empty to use the main price. Turn an option off to hide it without deleting it.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Advanced */}
          <details className={cn(card, "group")}>
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              More details <span className="text-xs font-normal text-muted">optional · material, size chart, tags, SEO…</span>
              <Icon name="chevron-down" size={18} className="text-muted transition group-open:rotate-180" />
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Short subtitle" htmlFor="subtitle" className="sm:col-span-2"><Input id="subtitle" value={v.subtitle} onChange={text("subtitle")} maxLength={200} /></Field>
              <Field label="Material" htmlFor="material"><Input id="material" value={v.material} onChange={text("material")} placeholder="240 GSM cotton" /></Field>
              <Field label="Dimensions / size info" htmlFor="dimensions"><Input id="dimensions" value={v.dimensions} onChange={text("dimensions")} /></Field>
              <Field label="Weight (grams)" htmlFor="weightGrams" hint="Used for shipping."><Input id="weightGrams" type="number" inputMode="numeric" value={v.weightGrams} onChange={text("weightGrams")} /></Field>
              <Field label="Warranty" htmlFor="warranty"><Input id="warranty" value={v.warranty} onChange={text("warranty")} /></Field>
              <Field label="Care instructions" htmlFor="care" className="sm:col-span-2"><Input id="care" value={v.careInstructions} onChange={text("careInstructions")} /></Field>
              <Field label="Licensing / authenticity" htmlFor="authenticity" hint="Shown to shoppers. Be accurate: officially licensed, or original design." className="sm:col-span-2"><Input id="authenticity" value={v.authenticity} onChange={text("authenticity")} /></Field>
              <Field label="Tags" htmlFor="tags" hint="Comma separated. Helps search."><Input id="tags" value={v.tags} onChange={text("tags")} placeholder="streetwear, gift" /></Field>
              <Field label="Brand" htmlFor="brandId">
                <Select id="brandId" value={v.brandId} onChange={text("brandId")}>
                  <option value="">None</option>
                  {brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Product type" htmlFor="kind">
                <Select id="kind" value={v.kind} onChange={text("kind")}>
                  <option value="STANDARD">Standard</option>
                  <option value="BUNDLE">Bundle / gift set</option>
                  <option value="MYSTERY_BOX">Mystery box</option>
                  <option value="PRE_ORDER">Pre-order</option>
                </Select>
              </Field>
              <Field label="Video link (MP4)" htmlFor="videoUrl"><Input id="videoUrl" value={v.videoUrl} onChange={text("videoUrl")} placeholder="https://" /></Field>
              <Field label="Low-stock alert at" htmlFor="lowStockThreshold"><Input id="lowStockThreshold" type="number" inputMode="numeric" value={v.lowStockThreshold} onChange={text("lowStockThreshold")} /></Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-muted">
                <input type="checkbox" checked={v.allowBackorder} onChange={(e) => set("allowBackorder", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Allow orders when out of stock (pre-order)
              </label>
              <p className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted sm:col-span-2">Google / search listing</p>
              <Field label="Web address" htmlFor="slug" hint={`/p/${v.slug || "made-from-the-name"}`}><Input id="slug" value={v.slug} onChange={text("slug")} /></Field>
              <Field label="Search title" htmlFor="seoTitle" hint={`${v.seoTitle.length}/70`}><Input id="seoTitle" value={v.seoTitle} onChange={text("seoTitle")} maxLength={70} /></Field>
              <Field label="Search description" htmlFor="seoDescription" hint={`${v.seoDescription.length}/170`} className="sm:col-span-2"><Textarea id="seoDescription" rows={2} value={v.seoDescription} onChange={text("seoDescription")} maxLength={170} /></Field>
              {withOptions && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">SKU codes (auto-generated if empty)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {variants.map((r) => (
                      <label key={variantKey(r)} className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-28 truncate">{[r.color, r.size, r.style].filter(Boolean).join(" / ")}</span>
                        <input value={r.sku} onChange={(e) => updateRow(r, { sku: e.target.value.toUpperCase() })} placeholder="auto" className={cn(inputClass, "h-9 flex-1 px-2 font-mono text-xs")} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {!withOptions && (
                <Field label="SKU code" htmlFor="sku" hint="Auto-generated if empty."><Input id="sku" value={variants[0]?.sku ?? ""} onChange={(e) => updateRow(variants[0]!, { sku: e.target.value.toUpperCase() })} className="font-mono" placeholder="auto" /></Field>
              )}
            </div>
          </details>
        </div>

        {/* Side */}
        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <section className={card}>
            <SectionTitle title="Visibility" />
            <div className="space-y-2">
              {[
                ["ACTIVE", "Visible in store", "Customers can see and buy it"],
                ["DRAFT", "Hidden (draft)", "Only you can see it"],
                ["SCHEDULED", "Launch later", "Goes live at a date and time"],
                ...(productId ? [["ARCHIVED", "Archived", "Removed from the store"]] : []),
              ].map(([val, t, d]) => (
                <label key={val} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm", v.status === val ? "border-fg bg-surface-2" : "border-line")}>
                  <input type="radio" name="status" checked={v.status === val} onChange={() => set("status", val!)} className="mt-0.5 accent-[var(--accent)]" />
                  <span><b className="block">{t}</b><span className="text-xs text-muted">{d}</span></span>
                </label>
              ))}
            </div>
            {v.status === "SCHEDULED" && (
              <Field label="Launch date & time" htmlFor="launchAt" className="mt-3">
                <Input id="launchAt" type="datetime-local" suppressHydrationWarning value={isoToLocal(v.launchAt)} onChange={(e) => set("launchAt", e.target.value ? new Date(e.target.value).toISOString() : "")} />
              </Field>
            )}
          </section>
          <section className={card}>
            <SectionTitle title="Badges" hint="Where this product shows up" />
            <div className="flex flex-wrap gap-2">
              <Toggle on={v.isNewArrival} onClick={() => set("isNewArrival", !v.isNewArrival)} label="New arrival" />
              <Toggle on={v.isLimited} onClick={() => set("isLimited", !v.isLimited)} label="Limited edition" />
              <Toggle on={v.isFeatured} onClick={() => set("isFeatured", !v.isFeatured)} label="Featured" />
            </div>
          </section>
          <section className={card}>
            <SectionTitle title="Returns" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.returnable} onChange={(e) => set("returnable", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" /> Customers can return this
            </label>
            {v.returnable && (
              <Field label="Return window (days)" htmlFor="returnWindowDays" hint="Empty = category default (usually 7)" className="mt-3">
                <Input id="returnWindowDays" type="number" inputMode="numeric" value={v.returnWindowDays} onChange={text("returnWindowDays")} />
              </Field>
            )}
          </section>
          {productId && (
            <section className={cn(card, "space-y-2")}>
              <DuplicateButton productId={productId} />
              {canDelete && (
                <Button variant="danger" size="sm" className="w-full" disabled={pending} onClick={() => {
                  if (!confirm("Delete this product? Products with orders are archived instead.")) return;
                  start(async () => {
                    const r = await deleteProductAction(productId);
                    if (!r.ok) return toast({ tone: "error", title: r.error });
                    toast({ title: r.message ?? "Deleted" });
                    router.push("/admin/products");
                  });
                }}>Delete product</Button>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* Sticky save bar */}
      <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:left-[248px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="hidden min-w-0 flex-1 truncate text-sm text-muted sm:block">
            {v.name || "New product"} · <span className={v.status === "ACTIVE" ? "text-success" : ""}>{v.status === "ACTIVE" ? "visible" : v.status === "SCHEDULED" ? "scheduled" : v.status === "ARCHIVED" ? "archived" : "hidden"}</span>
          </p>
          {storeUrl && v.status === "ACTIVE" && <a href={storeUrl} target="_blank" rel="noreferrer" className="hidden h-11 items-center rounded-full border border-line px-4 text-sm sm:flex">View</a>}
          {!productId && v.status === "ACTIVE" && (
            <Button variant="outline" className="flex-1 sm:flex-none" disabled={pending} onClick={() => save("DRAFT")}>Save as draft</Button>
          )}
          <Button className="flex-1 sm:flex-none sm:px-8" loading={pending} onClick={() => save()}>
            {productId ? "Save changes" : v.status === "ACTIVE" ? "Publish product" : "Save product"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function isoToLocal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function SectionTitle({ n, title, hint }: { n?: number; title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 font-semibold">
        {n && <span className="grid h-6 w-6 place-items-center rounded-full bg-fg text-xs text-bg">{n}</span>}
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function ModeButton({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cn("rounded-xl border p-3 text-left transition", active ? "border-fg bg-surface-2" : "border-line hover:border-line-strong")}>
      <b className="block text-sm">{title}</b>
      <span className="text-xs text-muted">{desc}</span>
    </button>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cn("rounded-full border px-3 py-1.5 text-sm transition", on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg")}>
      {on && "✓ "}
      {label}
    </button>
  );
}

function ChipPicker({ label, values, onChange, presets, extraPresets = [], placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; presets: string[]; extraPresets?: string[]; placeholder: string }) {
  const [custom, setCustom] = useState("");
  const toggle = (x: string) => onChange(values.includes(x) ? values.filter((y) => y !== x) : [...values, x]);
  const all = [...new Set([...presets, ...extraPresets, ...values])];
  const add = () => {
    const x = custom.trim();
    if (x && !values.includes(x)) onChange([...values, x]);
    setCustom("");
  };
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {all.map((x) => (
          <button key={x} type="button" onClick={() => toggle(x)} aria-pressed={values.includes(x)} className={cn("h-9 min-w-11 rounded-full border px-3 text-sm transition", values.includes(x) ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-fg hover:text-fg")}>
            {x}
          </button>
        ))}
        <span className="flex items-center gap-1">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder={placeholder} aria-label={`Add ${label}`} className={cn(compactInput, "h-9 w-40 px-3 text-sm")} maxLength={40} />
          {custom && <button type="button" onClick={add} className="h-9 rounded-full bg-surface-3 px-3 text-sm">Add</button>}
        </span>
      </div>
    </div>
  );
}

function ColorPicker({ values, onChange }: { values: { name: string; hex: string }[]; onChange: (v: { name: string; hex: string }[]) => void }) {
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#ff7eb6");
  const has = (n: string) => values.some((v) => v.name === n);
  const toggle = (c: { name: string; hex: string }) => onChange(has(c.name) ? values.filter((v) => v.name !== c.name) : [...values, c]);
  const all = [...COLOR_PRESETS, ...values.filter((v) => !COLOR_PRESETS.some((p) => p.name === v.name))];
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Colours</p>
      <div className="flex flex-wrap gap-2">
        {all.map((c) => (
          <button key={c.name} type="button" onClick={() => toggle(c)} aria-pressed={has(c.name)} className={cn("flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition", has(c.name) ? "border-fg bg-surface-3 text-fg" : "border-line text-muted hover:border-fg")}>
            <span className="h-4 w-4 rounded-full border border-line-strong" style={{ background: c.hex }} />
            {c.name}
            {has(c.name) && <Icon name="check" size={13} />}
          </button>
        ))}
        <span className="flex items-center gap-1">
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-9 w-9 cursor-pointer rounded-full border border-line bg-transparent" aria-label="Pick colour" />
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (name.trim()) { toggle({ name: name.trim(), hex }); setName(""); } } }} placeholder="Other colour" aria-label="Other colour name" className={cn(compactInput, "h-9 w-32 px-3 text-sm")} maxLength={30} />
          {name && <button type="button" onClick={() => { toggle({ name: name.trim(), hex }); setName(""); }} className="h-9 rounded-full bg-surface-3 px-3 text-sm">Add</button>}
        </span>
      </div>
    </div>
  );
}

function BulkStock({ onApply }: { onApply: (n: string) => void }) {
  const [n, setN] = useState("");
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      Set all stock to
      <input type="number" inputMode="numeric" min={0} value={n} onChange={(e) => setN(e.target.value)} className={cn(compactInput, "h-8 w-16 px-2 text-xs")} aria-label="Stock for all options" />
      <button type="button" disabled={n === ""} onClick={() => onApply(n)} className="h-8 rounded-full bg-surface-3 px-3 font-medium text-fg disabled:opacity-40">Apply</button>
    </span>
  );
}

function DuplicateButton({ productId }: { productId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <Button variant="outline" size="sm" className="w-full" loading={pending} onClick={() => start(async () => {
      const r = await duplicateProductAction(productId);
      if (!r.ok || !r.data) return toast({ tone: "error", title: r.ok ? "Couldn't duplicate" : r.error });
      toast({ title: "Copy created as a draft" });
      router.push(`/admin/products/${r.data.id}`);
    })}>
      <Icon name="copy" size={15} /> Duplicate
    </Button>
  );
}
