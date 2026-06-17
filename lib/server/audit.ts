import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { warnInDevelopment } from "@/lib/server/errors";

type AuditInput = {
  userId?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "PAYMENT_CONFIRMATION" | "REFUND_REQUEST";
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLogSafe(input: AuditInput) {
  try {
    const requestedUserId = input.userId?.trim() || null;
    const user = requestedUserId
      ? await prisma.user.findUnique({
          where: { id: requestedUserId },
          select: { id: true }
        })
      : null;

    return await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata
      }
    });
  } catch (error) {
    warnInDevelopment("AuditLog skipped", error);
    return null;
  }
}

export const writeAuditLog = writeAuditLogSafe;
