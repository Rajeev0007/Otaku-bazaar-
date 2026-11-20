import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton, SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { deleteTaxonomyAction, saveTaxonomyAction } from "@/app/admin/actions";

export default async function CatalogPage() {
  await requireStaff("catalog.write", "/admin/catalog");
  const [categories, franchises] = await Promise.all([
    db.category.findMany({ orderBy: [{ parentId: "asc" }, { position: "asc" }], include: { parent: { select: { name: true } }, _count: { select: { products: true } } } }),
    db.animeFranchise.findMany({ orderBy: { position: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);
  const parents = categories.filter((c) => !c.parentId);

  return (
    <>
      <PageHeader title="Categories & anime" description="Controls the navigation menu, category pages and anime collection pages." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Categories" description="Top-level categories with “Show in menu” appear in the main navigation.">
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id}>
                <details className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1.5 text-sm">
                    <span>
                      {c.parent && <span className="text-muted">{c.parent.name} › </span>}
                      <span className="font-medium">{c.name}</span>
                      {!c.isActive && <span className="ml-2 text-xs text-danger">hidden</span>}
                    </span>
                    <span className="text-xs text-muted">{c._count.products} products · edit</span>
                  </summary>
                  <TaxonomyForm kind="category" row={c} parents={parents} />
                  <div className="mt-2 text-right">
                    <ConfirmButton action={deleteTaxonomyAction.bind(null, "category", c.id)} label="Delete category" confirmText={`Delete ${c.name}? Subcategories become top-level.`} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details className="mt-4 rounded-xl border border-dashed border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">+ Add category</summary>
            <TaxonomyForm kind="category" parents={parents} />
          </details>
        </Card>

        <Card title="Anime / franchises" description="Each gets an SEO landing page at /anime/slug.">
          <ul className="divide-y divide-line">
            {franchises.map((f) => (
              <li key={f.id}>
                <details className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: f.accentColor ?? "#888" }} />
                      <span className="font-medium">{f.name}</span>
                      {f.isTrending && <span className="text-xs text-accent">trending</span>}
                    </span>
                    <span className="text-xs text-muted">{f._count.products} products · edit</span>
                  </summary>
                  <TaxonomyForm kind="franchise" row={f} />
                  <div className="mt-2 text-right">
                    <ConfirmButton action={deleteTaxonomyAction.bind(null, "franchise", f.id)} label="Delete" confirmText={`Delete ${f.name}? Products keep existing but lose this tag.`} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <details className="mt-4 rounded-xl border border-dashed border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">+ Add anime</summary>
            <TaxonomyForm kind="franchise" />
          </details>
        </Card>
      </div>
    </>
  );
}

type Row = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  seoTitle: string | null;
  seoDescription: string | null;
  parentId?: string | null;
  isActive?: boolean;
  showInMenu?: boolean;
  returnWindowDays?: number | null;
  accentColor?: string | null;
  isTrending?: boolean;
};

function TaxonomyForm({ kind, row, parents = [] }: { kind: "category" | "franchise"; row?: Row; parents?: { id: string; name: string }[] }) {
  const p = `${kind}-${row?.id ?? "new"}`;
  return (
    <SimpleForm action={saveTaxonomyAction} extra={{ kind, id: row?.id }} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess={!row}>
      <Field label="Name" htmlFor={`${p}-name`}><Input id={`${p}-name`} name="name" defaultValue={row?.name} required /></Field>
      <Field label="URL slug" htmlFor={`${p}-slug`}><Input id={`${p}-slug`} name="slug" defaultValue={row?.slug} placeholder="auto from name" /></Field>
      {kind === "category" ? (
        <>
          <Field label="Parent" htmlFor={`${p}-parent`}>
            <Select id={`${p}-parent`} name="parentId" defaultValue={row?.parentId ?? ""}>
              <option value="">None (top level)</option>
              {parents.filter((x) => x.id !== row?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="Return window (days)" htmlFor={`${p}-rw`}><Input id={`${p}-rw`} name="returnWindowDays" type="number" defaultValue={row?.returnWindowDays ?? ""} placeholder="store default" /></Field>
        </>
      ) : (
        <>
          <Field label="Accent colour" htmlFor={`${p}-color`}><Input id={`${p}-color`} name="accentColor" type="color" defaultValue={row?.accentColor ?? "#f0506e"} className="h-11 p-1" /></Field>
          <div className="flex items-end pb-2"><Checkbox name="isTrending" defaultChecked={row?.isTrending} label="Trending (shown first)" /></div>
        </>
      )}
      <Field label="Image URL" htmlFor={`${p}-img`} className="sm:col-span-2"><Input id={`${p}-img`} name="imageUrl" defaultValue={row?.imageUrl ?? ""} /></Field>
      <Field label="Description" htmlFor={`${p}-desc`} className="sm:col-span-2"><Textarea id={`${p}-desc`} name="description" rows={2} defaultValue={row?.description ?? ""} /></Field>
      <Field label="Meta title" htmlFor={`${p}-st`}><Input id={`${p}-st`} name="seoTitle" defaultValue={row?.seoTitle ?? ""} maxLength={70} /></Field>
      <Field label="Position" htmlFor={`${p}-pos`}><Input id={`${p}-pos`} name="position" type="number" defaultValue={row?.position ?? 0} /></Field>
      <Field label="Meta description" htmlFor={`${p}-sd`} className="sm:col-span-2"><Textarea id={`${p}-sd`} name="seoDescription" rows={2} defaultValue={row?.seoDescription ?? ""} maxLength={170} /></Field>
      {kind === "category" && (
        <div className="flex gap-6 sm:col-span-2">
          <Checkbox name="isActive" defaultChecked={row?.isActive ?? true} label="Active" />
          <Checkbox name="showInMenu" defaultChecked={row?.showInMenu ?? true} label="Show in menu" />
        </div>
      )}
    </SimpleForm>
  );
}
