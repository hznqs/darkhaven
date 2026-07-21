import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/security";
import { safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;

  try {
    const existing = await prisma.postSale.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Atendimento de pós-venda não encontrado." }, { status: 404 });
    }

    await prisma.postSale.delete({ where: { id } });

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "DELETE",
      entity: "PostSale",
      entityId: id,
    });

    return NextResponse.json({ data: { id } });
  } catch (error) {
    warnInDevelopment("PostSale delete failed", error);
    return safeErrorResponse("Não foi possível excluir o atendimento.");
  }
}
