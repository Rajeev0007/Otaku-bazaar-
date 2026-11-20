import Link from "next/link";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { SimpleForm } from "@/components/admin/simple-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { savePageAction } from "@/app/admin/actions";

export default async function PagesAdmin({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requireStaff("content.write", "/admin/pages");
  const { edit } = await searchParams;
  const pages = await db.page.findMany({ orderBy: { title: "asc" } });
  const current = edit === "new" ? null : pages.find((p) => p.id === edit) ?? pages[0] ?? null;
  const placeholders = current ? (current.body.match(/\[[^\]\n]{2,60}\]/g) ?? []).filter((m) => !m.startsWith("[http")) : [];

  return (
    <>
      <PageHeader title="Pages & policies" description="Legal and information pages. Text in [square brackets] is a placeholder you must replace before launch." />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card>
          <ul className="space-y-1 text-sm">
            {pages.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/pages?edit=${p.id}`} className={`block rounded-lg px-3 py-2 ${current?.id === p.id ? "bg-surface-3 font-medium" : "text-muted hover:bg-surface-2 hover:text-fg"}`}>
                  {p.title}
                  {/\[[^\]]+\]/.test(p.body) && <span className="ml-1.5 text-xs text-warning">●</span>}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/admin/pages?edit=new" className="block rounded-lg px-3 py-2 text-accent hover:bg-surface-2">+ New page</Link>
            </li>
          </ul>
          <p className="mt-3 px-3 text-xs text-muted"><span className="text-warning">●</span> has unfilled placeholders</p>
        </Card>
        <Card title={current ? `Edit: ${current.title}` : "New page"} actions={current && <Link href={`/pages/${current.slug}`} target="_blank" className="text-xs text-muted hover:text-fg">View ↗</Link>}>
          {placeholders.length > 0 && (
            <p className="mb-4 rounded-xl bg-warning/10 p-3 text-xs text-warning">
              {placeholders.length} placeholder{placeholders.length === 1 ? "" : "s"} to replace: {[...new Set(placeholders)].slice(0, 8).join(", ")}
              {placeholders.length > 8 ? "…" : ""}
            </p>
          )}
          <SimpleForm key={current?.id ?? "new"} action={savePageAction} extra={{ id: current?.id }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor="title"><Input id="title" name="title" defaultValue={current?.title ?? ""} required /></Field>
              <Field label="URL slug" htmlFor="slug" hint={`/pages/${current?.slug ?? "…"}`}><Input id="slug" name="slug" defaultValue={current?.slug ?? ""} /></Field>
            </div>
            <Field label="Content (Markdown)" htmlFor="body" hint="## Heading, - list item, **bold**, _italic_, [link](/path), > callout">
              <Textarea id="body" name="body" rows={22} defaultValue={current?.body ?? ""} className="font-mono text-sm" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Meta title" htmlFor="seoTitle"><Input id="seoTitle" name="seoTitle" defaultValue={current?.seoTitle ?? ""} maxLength={70} /></Field>
              <Field label="Meta description" htmlFor="seoDescription"><Input id="seoDescription" name="seoDescription" defaultValue={current?.seoDescription ?? ""} maxLength={170} /></Field>
            </div>
            <Checkbox name="isPublished" defaultChecked={current?.isPublished ?? true} label="Published" />
          </SimpleForm>
        </Card>
      </div>
    </>
  );
}
