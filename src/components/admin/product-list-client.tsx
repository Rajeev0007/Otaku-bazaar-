"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import type { ProductStatus } from "@prisma/client";
import { useToast } from "@/components/ui/toast";
import { Icon } from "@/components/ui/icon";
import { bulkStatusAction } from "@/app/admin/actions";

export function AdminProductSearch({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const pathname = usePathname();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname);
      }}
      className="flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5"
    >
      <Icon name="search" size={15} className="text-subtle" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or SKU" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Search products" />
    </form>
  );
}

/** Wraps the product table; reads checked rows and applies bulk status changes. */
export function BulkBar({ children, canWrite, canDelete }: { children: ReactNode; canWrite: boolean; canDelete: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const selected = () => [...(ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked') ?? [])].map((i) => i.value);

  function run(status: ProductStatus) {
    const ids = selected();
    if (!ids.length) return;
    if (status === "ARCHIVED" && !confirm(`Archive ${ids.length} product(s)? They will be hidden from the store.`)) return;
    start(async () => {
      const r = await bulkStatusAction(ids, status);
      toast(r.ok ? { title: r.message ?? "Updated" } : { tone: "error", title: r.error });
      ref.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((i) => (i.checked = false));
      setCount(0);
      router.refresh();
    });
  }

  return (
    <div ref={ref} onChange={() => setCount(selected().length)}>
      {count > 0 && (canWrite || canDelete) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface-2 p-2 pl-4 text-sm">
          <span className="mr-auto font-medium">{count} selected</span>
          {canWrite && (
            <>
              <button disabled={pending} onClick={() => run("ACTIVE")} className="rounded-full px-3 py-1.5 hover:bg-surface-3">Set active</button>
              <button disabled={pending} onClick={() => run("DRAFT")} className="rounded-full px-3 py-1.5 hover:bg-surface-3">Set draft</button>
            </>
          )}
          {canDelete && <button disabled={pending} onClick={() => run("ARCHIVED")} className="rounded-full px-3 py-1.5 text-danger hover:bg-danger/10">Archive</button>}
        </div>
      )}
      {children}
    </div>
  );
}
