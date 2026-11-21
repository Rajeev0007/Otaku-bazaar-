import Link from "next/link";
import type { Faq } from "@prisma/client";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton, SimpleForm } from "@/components/admin/simple-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { deleteFaqAction, saveFaqAction } from "@/app/admin/actions";

const GROUPS = [
  ["orders", "Orders"],
  ["shipping", "Shipping & delivery"],
  ["payment", "Payments"],
  ["returns", "Returns & refunds"],
  ["account", "Account"],
  ["general", "General"],
] as const;

export default async function FaqAdminPage() {
  await requireStaff("content.write", "/admin/faq");
  const faqs = await db.faq.findMany({ orderBy: [{ group: "asc" }, { position: "asc" }] });
  return (
    <>
      <PageHeader
        title="FAQs"
        description={
          <>
            Questions and answers shown on the <Link href="/support" className="underline" target="_blank">Help &amp; support</Link> page. Lower position numbers show first.
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {faqs.length === 0 && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">No FAQs yet. Add your first one.</p>}
          {GROUPS.filter(([g]) => faqs.some((f) => f.group === g)).map(([g, label]) => (
            <Card key={g} title={label}>
              <ul className="divide-y divide-line">
                {faqs.filter((f) => f.group === g).map((f) => (
                  <li key={f.id} className="py-3">
                    <details>
                      <summary className="flex cursor-pointer items-start justify-between gap-3 text-sm font-medium">
                        <span>{f.question}</span>
                        <span className="shrink-0 text-xs font-normal text-muted">Edit</span>
                      </summary>
                      <div className="mt-3">
                        <FaqForm faq={f} />
                        <div className="mt-3 text-right">
                          <ConfirmButton action={deleteFaqAction.bind(null, f.id)} label="Delete" confirmText="Delete this FAQ?" />
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Card title="Add a question">
          <FaqForm />
        </Card>
      </div>
    </>
  );
}

function FaqForm({ faq }: { faq?: Faq }) {
  const p = faq?.id ?? "new";
  return (
    <SimpleForm action={saveFaqAction} extra={{ id: faq?.id ?? "" }} submitLabel={faq ? "Save" : "Add FAQ"} resetOnSuccess={!faq}>
      <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
        <Field label="Section" htmlFor={`g-${p}`}>
          <Select id={`g-${p}`} name="group" defaultValue={faq?.group ?? "orders"}>
            {GROUPS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Position" htmlFor={`pos-${p}`}>
          <Input id={`pos-${p}`} name="position" type="number" min={0} max={999} defaultValue={faq?.position ?? 0} />
        </Field>
      </div>
      <Field label="Question" htmlFor={`q-${p}`}>
        <Input id={`q-${p}`} name="question" required maxLength={200} defaultValue={faq?.question} placeholder="When will my order ship?" />
      </Field>
      <Field label="Answer" htmlFor={`a-${p}`}>
        <Textarea id={`a-${p}`} name="answer" required maxLength={2000} rows={4} defaultValue={faq?.answer} />
      </Field>
    </SimpleForm>
  );
}
