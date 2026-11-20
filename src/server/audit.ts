import { Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";

export async function audit(
  entry: { actorId?: string | null; action: string; entityType: string; entityId?: string | null; data?: Prisma.InputJsonValue; ip?: string },
  tx: Tx | typeof db = db,
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      data: entry.data,
      ip: entry.ip,
    },
  });
}
