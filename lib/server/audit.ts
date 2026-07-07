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

    const safeMetadata =
      typeof input.metadata === "object" && input.metadata !== null
        ? (Object.fromEntries(
            Object.entries(input.metadata as Record<string, unknown>).map(([k, v]) => [
              k,
              typeof v === "string" ? v.slice(0, 500) : v
            ])
          ) as Prisma.InputJsonValue)
        : input.metadata;

    return await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: safeMetadata
      }
    });
  } catch (error) {
    warnInDevelopment("AuditLog skipped", error);
    return null;
  }
}

export const writeAuditLog = writeAuditLogSafe;
