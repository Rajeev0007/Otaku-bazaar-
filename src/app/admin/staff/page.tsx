import { requireStaff } from "@/server/auth/session";
import { db } from "@/server/db";
import { PERMISSIONS } from "@/server/auth/permissions";
import { Card, PageHeader, Table } from "@/components/admin/ui";
import { StaffRoleForm } from "@/components/admin/staff-form";

export default async function StaffPage() {
  await requireStaff("staff.manage", "/admin/staff");
  const [roles, staff] = await Promise.all([
    db.role.findMany({ orderBy: { name: "asc" }, include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } }),
    db.user.findMany({ where: { isStaff: true }, orderBy: { email: "asc" }, include: { roles: { include: { role: true } } } }),
  ]);
  const roleOptions = roles.map((r) => ({ key: r.key, name: r.name }));

  return (
    <>
      <PageHeader title="Staff & roles" description="Grant store staff access by role. Changing someone's roles signs them out so new permissions apply immediately." />
      <div className="space-y-6">
        <Card title="Add or update a staff member" description="The person must already have a customer account.">
          <StaffRoleForm roles={roleOptions} />
        </Card>
        <Table head={["Staff member", "Roles", "Last login", "Edit"]}>
          {staff.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3">
                <span className="font-medium">{u.name ?? "—"}</span>
                <span className="block text-xs text-muted">{u.email}</span>
              </td>
              <td className="px-4 py-3 text-sm">{u.roles.map((r) => r.role.name).join(", ") || <span className="text-muted">No roles</span>}</td>
              <td className="px-4 py-3 text-xs text-muted">{u.lastLoginAt?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) ?? "Never"}</td>
              <td className="px-4 py-3">
                <StaffRoleForm roles={roleOptions} email={u.email} current={u.roles.map((r) => r.role.key)} compact />
              </td>
            </tr>
          ))}
        </Table>
        <Card title="Role permissions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="text-left text-muted">
                  <th className="py-2 pr-4 font-medium">Permission</th>
                  {roles.map((r) => <th key={r.id} className="px-2 py-2 text-center font-medium">{r.name}<span className="block font-normal text-subtle">{r._count.users} staff</span></th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {Object.entries(PERMISSIONS).map(([key, desc]) => (
                  <tr key={key}>
                    <td className="py-2 pr-4"><span className="font-mono">{key}</span><span className="block text-subtle">{desc}</span></td>
                    {roles.map((r) => <td key={r.id} className="px-2 py-2 text-center">{r.permissions.some((p) => p.permission.key === key) ? <span className="text-success">●</span> : <span className="text-subtle">·</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
