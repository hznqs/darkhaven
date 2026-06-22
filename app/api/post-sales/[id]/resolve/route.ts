import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { serializePostSale } from "@/lib/server/serializers";
import { requireAdmin } from "@/lib/server/security";
import { parseJsonBody, safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const body = await parseJsonBody<{ resolution?: string }>(request);
  if (!body.ok) return body.response;

  const resolution = body.data.resolution?.trim() || "Atendimento resolvido.";
  if (resolution.length < 5 || resolution.length > 800) {
    return NextResponse.json({ error: "A resolução precisa ter entre 5 e 800 caracteres." }, { status: 422 });
  }

  try {
    const existing = await prisma.postSale.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!existing) {
      return NextResponse.json({ error: "Atendimento de pós-venda não encontrado." }, { status: 404 });
    }
    if (existing.status === "RESOLVED") {
      return NextResponse.json({ error: "Atendimento já resolvido." }, { status: 409 });
    }

    const record = await prisma.postSale.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolution,
        resolvedAt: new Date(),
        history: {
          create: {
            message: "Atendimento marcado como resolvido."
          }
        }
      },
      include: {
        customer: true,
        order: true,
        sale: true,
        responsibleUser: {
          select: { name: true }
        }
      }
    });

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "STATUS_CHANGE",
      entity: "PostSale",
      entityId: id,
      metadata: { status: "RESOLVED" }
    });

    return NextResponse.json({ data: serializePostSale(record) });
  } catch (error) {
    warnInDevelopment("PostSale resolve failed", error);
    return safeErrorResponse("Não foi possível resolver o atendimento.");
  }
}
