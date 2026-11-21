"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { setCustomerStatusAction } from "@/app/admin/actions";

export function CustomerStatusControl({ userId, status }: { userId: string; status: string }) {
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const run = (s: "ACTIVE" | "SUSPENDED" | "BANNED") => {
    if (s !== "ACTIVE" && !reason.trim()) return toast({ tone: "error", title: "Write a short reason first (kept in the audit log)." });
    if (s === "BANNED" && !confirm("Ban this customer? They won't be able to sign in.")) return;
    start(async () => {
      const r = await setCustomerStatusAction(userId, s, reason);
      toast(r.ok ? { title: r.message ?? "Saved" } : { tone: "error", title: r.error });
      router.refresh();
    });
  };
  return (
    <div className="space-y-3">
      {status === "ACTIVE" ? (
        <>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. repeated fake COD orders)" maxLength={300} aria-label="Reason" />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" loading={pending} onClick={() => run("SUSPENDED")}>Suspend</Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => run("BANNED")}>Ban</Button>
          </div>
        </>
      ) : (
        <Button size="sm" loading={pending} onClick={() => run("ACTIVE")}>Reactivate account</Button>
      )}
    </div>
  );
}
