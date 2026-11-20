"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { setStaffRolesAction } from "@/app/admin/actions";

export function StaffRoleForm({ roles, email, current = [], compact }: { roles: { key: string; name: string }[]; email?: string; current?: string[]; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  const [addr, setAddr] = useState(email ?? "");
  const [selected, setSelected] = useState<string[]>(current);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  if (!open) return <button onClick={() => setOpen(true)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-surface-2">Change roles</button>;
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected.length && !confirm(`Remove all staff access for ${addr}?`)) return;
        start(async () => {
          const r = await setStaffRolesAction(addr, selected);
          toast(r.ok ? { title: r.message ?? "Saved" } : { tone: "error", title: r.error });
          if (r.ok) {
            if (compact) setOpen(false);
            else {
              setAddr("");
              setSelected([]);
            }
            router.refresh();
          }
        });
      }}
    >
      {!email && <Input type="email" required placeholder="staff@example.com" value={addr} onChange={(e) => setAddr(e.target.value)} aria-label="Staff email" className="max-w-sm" />}
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => (
          <label key={r.key} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${selected.includes(r.key) ? "border-fg bg-surface-2" : "border-line text-muted"}`}>
            <input type="checkbox" className="accent-[var(--accent)]" checked={selected.includes(r.key)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.key] : s.filter((k) => k !== r.key)))} />
            {r.name}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={pending}>Save roles</Button>
        {compact && <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
      </div>
    </form>
  );
}
