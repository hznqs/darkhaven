import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireCron } from "@/lib/server/security";
import { warnInDevelopment } from "@/lib/server/errors";
import { writeAuditLogSafe } from "@/lib/server/audit";

export async function GET(request: NextRequest) {
  const cronAuth = requireCron(request);
  if (!cronAuth.ok) {
    return NextResponse.json({ error: cronAuth.message }, { status: cronAuth.status });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Encontra os leads para poder registrar no audit log antes de excluir em lote
    const leadsToDelete = await prisma.lead.findMany({
      where: {
        status: "CLOSED_LOST",
        updatedAt: {
          lt: sevenDaysAgo,
        },
      },
      select: { id: true },
    });

    if (leadsToDelete.length === 0) {
      return NextResponse.json({ message: "Nenhum lead para limpar.", count: 0 });
    }

    const { count } = await prisma.lead.deleteMany({
      where: {
        status: "CLOSED_LOST",
        updatedAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    // Registrar no log de auditoria
    // Em tarefas automatizadas, userId pode ser nulo ou um identificador de sistema
    for (const lead of leadsToDelete) {
      await writeAuditLogSafe({
        action: "DELETE",
        entity: "Lead",
        entityId: lead.id,
        metadata: { reason: "Automated cleanup: CLOSED_LOST > 7 days" },
      });
    }

    return NextResponse.json({ message: "Leads antigos removidos com sucesso.", count });
  } catch (error) {
    warnInDevelopment("Cron cleanup-leads failed", error);
    return NextResponse.json({ error: "Falha ao limpar leads." }, { status: 500 });
  }
}
