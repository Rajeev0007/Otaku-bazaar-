import Link from "next/link";
import { ModerationStatus } from "@prisma/client";
import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionButton, ConfirmButton, SimpleForm } from "@/components/admin/simple-form";
import { Textarea } from "@/components/ui/field";
import { answerQuestionAction, moderateReviewAction } from "@/app/admin/actions";

export default async function ReviewsAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  await requireStaff("reviews.moderate", "/admin/reviews");
  const sp = await searchParams;
  const tab = sp.tab === "questions" ? "questions" : "reviews";
  const status = sp.status && sp.status in ModerationStatus ? (sp.status as ModerationStatus) : "PENDING";
  const [counts, qCount] = await Promise.all([db.review.groupBy({ by: ["status"], _count: true }), db.productQuestion.count({ where: { status: "PENDING" } })]);
  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHeader title="Reviews & Q&A" description="Approve customer reviews and answer product questions. Only approved items appear on product pages." />
      <div className="mb-5 flex flex-wrap gap-2">
        <Tab href="/admin/reviews?status=PENDING" active={tab === "reviews" && status === "PENDING"} label={`Reviews to approve (${n("PENDING")})`} />
        <Tab href="/admin/reviews?status=APPROVED" active={tab === "reviews" && status === "APPROVED"} label={`Approved (${n("APPROVED")})`} />
        <Tab href="/admin/reviews?status=REJECTED" active={tab === "reviews" && status === "REJECTED"} label={`Rejected (${n("REJECTED")})`} />
        <Tab href="/admin/reviews?tab=questions" active={tab === "questions"} label={`Questions to answer (${qCount})`} />
      </div>
      {tab === "reviews" ? <ReviewList status={status} /> : <QuestionList />}
    </>
  );
}

function Tab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link href={href} className={`rounded-full px-3 py-1.5 text-sm ${active ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
      {label}
    </Link>
  );
}

async function ReviewList({ status }: { status: ModerationStatus }) {
  const reviews = await db.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 50, include: { product: { select: { name: true, slug: true } } } });
  if (!reviews.length) return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">Nothing here.</p>;
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">
                <span className="text-gold">{"★".repeat(r.rating)}</span>
                <span className="text-subtle">{"★".repeat(5 - r.rating)}</span> · <b>{r.authorName}</b>
                {r.isVerified && <span className="ml-1.5 text-xs text-success">verified purchase</span>}
                <span className="text-muted"> on </span>
                <Link href={`/p/${r.product.slug}`} className="hover:underline">{r.product.name}</Link>
              </p>
              {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
              <p className="mt-1 text-sm text-muted">{r.body}</p>
              <p className="mt-2 text-xs text-subtle">{r.createdAt.toLocaleString("en-IN")} {r.reportCount > 0 && <span className="text-danger">· reported {r.reportCount}×</span>}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {r.status !== "APPROVED" && <ActionButton action={moderateReviewAction.bind(null, r.id, "APPROVED")} className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success">Approve</ActionButton>}
              {r.status !== "REJECTED" && <ActionButton action={moderateReviewAction.bind(null, r.id, "REJECTED")} className="rounded-full border border-line px-3 py-1.5 text-xs">Reject</ActionButton>}
              <ConfirmButton action={moderateReviewAction.bind(null, r.id, "DELETE")} label="Delete" confirmText="Delete this review permanently?" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

async function QuestionList() {
  const qs = await db.productQuestion.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 50, include: { product: { select: { name: true, slug: true } }, user: { select: { email: true } } } });
  if (!qs.length) return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">No questions waiting.</p>;
  return (
    <div className="space-y-3">
      {qs.map((q) => (
        <Card key={q.id}>
          <p className="text-xs text-muted">
            <Link href={`/p/${q.product.slug}`} className="hover:underline">{q.product.name}</Link> · {q.user?.email ?? "customer"} · {q.createdAt.toLocaleDateString("en-IN")}
          </p>
          <p className="mt-1 font-medium">{q.question}</p>
          <SimpleForm action={answerQuestionAction.bind(null, q.id)} submitLabel="Publish answer" className="mt-3 space-y-2">
            <Textarea name="answer" rows={2} placeholder="Your answer (shown publicly on the product page)" aria-label="Answer" />
          </SimpleForm>
          <div className="mt-2">
            <ConfirmButton action={answerQuestionAction.bind(null, q.id, { reject: true })} label="Hide question" confirmText="Hide this question?" />
          </div>
        </Card>
      ))}
    </div>
  );
}
