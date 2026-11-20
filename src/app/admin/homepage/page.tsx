import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionButton, ConfirmButton, SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ProductImage } from "@/components/store/product-image";
import { deleteBannerAction, saveBannerAction, updateSectionAction } from "@/app/admin/actions";

const LABELS: Record<string, string> = {
  HERO: "Hero banners",
  CATEGORIES: "Shop by category",
  FRANCHISES: "Shop by anime",
  PRODUCT_RAIL: "Product rail",
  COLLECTIONS: "Featured collections",
  PROMO_BANNER: "Promo banner",
  REVIEWS: "Customer reviews",
  RECENTLY_VIEWED: "Recently viewed",
  VALUE_PROPS: "Shipping / returns highlights",
  NEWSLETTER: "Newsletter signup",
};

export default async function HomepageAdmin() {
  await requireStaff("content.write", "/admin/homepage");
  const [sections, banners] = await Promise.all([db.homepageSection.findMany({ orderBy: { position: "asc" } }), db.banner.findMany({ orderBy: [{ placement: "asc" }, { position: "asc" }] })]);
  const toLocal = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

  return (
    <>
      <PageHeader title="Homepage" description="Reorder, rename or hide sections, and manage banners. Changes go live immediately." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title="Sections">
          <ul className="divide-y divide-line">
            {sections.map((s, i) => (
              <li key={s.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <ActionButton action={updateSectionAction.bind(null, s.id, { move: "up" })} className="text-muted hover:text-fg disabled:opacity-30" title="Move up">
                      <Icon name="chevron-up" size={16} />
                    </ActionButton>
                    <ActionButton action={updateSectionAction.bind(null, s.id, { move: "down" })} className="text-muted hover:text-fg" title="Move down">
                      <Icon name="chevron-down" size={16} />
                    </ActionButton>
                  </div>
                  <span className="w-6 text-xs text-subtle">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${s.isActive ? "" : "text-muted line-through"}`}>{s.title || LABELS[s.type] || s.type}</p>
                    <p className="text-xs text-muted">{LABELS[s.type] ?? s.type}{s.type === "PRODUCT_RAIL" ? ` · ${String((s.config as { source?: string })?.source ?? "")}` : ""}</p>
                  </div>
                  <ActionButton action={updateSectionAction.bind(null, s.id, { isActive: !s.isActive })} className={`rounded-full px-3 py-1 text-xs font-medium ${s.isActive ? "bg-success/15 text-success" : "bg-surface-3 text-muted"}`}>
                    {s.isActive ? "Visible" : "Hidden"}
                  </ActionButton>
                </div>
                {!["HERO", "PROMO_BANNER", "VALUE_PROPS"].includes(s.type) && (
                  <details className="ml-12 mt-2">
                    <summary className="cursor-pointer text-xs text-muted hover:text-fg">Edit heading</summary>
                    <SimpleForm action={updateSectionAction.bind(null, s.id)} className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Input name="title" defaultValue={s.title ?? ""} placeholder="Title" aria-label="Title" />
                      <Input name="subtitle" defaultValue={s.subtitle ?? ""} placeholder="Subtitle" aria-label="Subtitle" />
                    </SimpleForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Banners" description="Hero banners rotate at the top of the homepage; the promo banner appears mid-page.">
          <ul className="space-y-4">
            {banners.map((b) => (
              <li key={b.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-14 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2"><ProductImage src={b.imageUrl} alt="" fill sizes="112px" className="object-cover" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.title}</p>
                    <p className="text-xs text-muted">{b.placement} · position {b.position} · {b.isActive ? "active" : "inactive"}</p>
                  </div>
                  <ConfirmButton action={deleteBannerAction.bind(null, b.id)} label="Delete" confirmText="Delete this banner?" />
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted hover:text-fg">Edit</summary>
                  <BannerForm banner={{ ...b, startsAt: toLocal(b.startsAt), endsAt: toLocal(b.endsAt) }} />
                </details>
              </li>
            ))}
          </ul>
          <details className="mt-4 rounded-xl border border-dashed border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">+ Add banner</summary>
            <BannerForm />
          </details>
        </Card>
      </div>
    </>
  );
}

function BannerForm({ banner }: { banner?: { id: string; placement: string; title: string; subtitle: string | null; ctaLabel: string | null; ctaHref: string | null; imageUrl: string; position: number; isActive: boolean; startsAt: string; endsAt: string } }) {
  const p = banner?.id ?? "new";
  return (
    <SimpleForm action={saveBannerAction} extra={{ id: banner?.id }} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess={!banner}>
      <Field label="Placement" htmlFor={`${p}-pl`}>
        <Select id={`${p}-pl`} name="placement" defaultValue={banner?.placement ?? "hero"}>
          <option value="hero">Hero (top carousel)</option>
          <option value="promo">Promo (mid-page)</option>
        </Select>
      </Field>
      <Field label="Position" htmlFor={`${p}-pos`}><Input id={`${p}-pos`} name="position" type="number" defaultValue={banner?.position ?? 0} /></Field>
      <Field label="Title" htmlFor={`${p}-t`} className="sm:col-span-2"><Input id={`${p}-t`} name="title" defaultValue={banner?.title} required /></Field>
      <Field label="Subtitle" htmlFor={`${p}-s`} className="sm:col-span-2"><Input id={`${p}-s`} name="subtitle" defaultValue={banner?.subtitle ?? ""} /></Field>
      <Field label="Button label" htmlFor={`${p}-cl`}><Input id={`${p}-cl`} name="ctaLabel" defaultValue={banner?.ctaLabel ?? ""} placeholder="Shop now" /></Field>
      <Field label="Button link" htmlFor={`${p}-ch`}><Input id={`${p}-ch`} name="ctaHref" defaultValue={banner?.ctaHref ?? ""} placeholder="/anime/naruto" /></Field>
      <Field label="Image URL (1600×700 recommended)" htmlFor={`${p}-img`} className="sm:col-span-2"><Input id={`${p}-img`} name="imageUrl" defaultValue={banner?.imageUrl ?? ""} required /></Field>
      <Field label="Starts (optional)" htmlFor={`${p}-sa`}><Input id={`${p}-sa`} name="startsAt" type="datetime-local" defaultValue={banner?.startsAt ?? ""} /></Field>
      <Field label="Ends (optional)" htmlFor={`${p}-ea`}><Input id={`${p}-ea`} name="endsAt" type="datetime-local" defaultValue={banner?.endsAt ?? ""} /></Field>
      <div className="sm:col-span-2"><Checkbox name="isActive" defaultChecked={banner?.isActive ?? true} label="Active" /></div>
    </SimpleForm>
  );
}
