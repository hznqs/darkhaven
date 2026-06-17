import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/security";
import { serializeLead } from "@/lib/server/serializers";
import { leadSchema } from "@/lib/server/validators";
import { parseJsonBody } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = leadSchema.partial().safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const currentLead = await prisma.lead.findUnique({ where: { id } });
  if (!currentLead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  const nextWhatsapp = parsed.data.whatsapp ?? currentLead.whatsapp;
  const nextName = parsed.data.name ?? currentLead.name;
  const nextStatus = parsed.data.status ?? currentLead.status;
  const isConverting = nextStatus === "CLOSED_WON";

  if (parsed.data.whatsapp && !isConverting) {
    const customer = await prisma.customer.findUnique({ where: { whatsapp: parsed.data.whatsapp }, select: { id: true } });
    if (customer) return NextResponse.json({ error: "Já existe cliente com este WhatsApp." }, { status: 409 });
  }

  let convertedCustomerId: string | undefined;
  const lead = await prisma.$transaction(async (tx) => {
    if (isConverting) {
      const customer = await tx.customer.upsert({
        where: { whatsapp: nextWhatsapp },
        update: {},
        create: {
          name: nextName,
          whatsapp: nextWhatsapp,
          status: "active",
          tags: ["Lead convertido"]
        },
        select: { id: true }
      });
      convertedCustomerId = customer.id;
    }

    return tx.lead.update({
      where: { id },
      data: {
        ...parsed.data,
        convertedCustomerId: isConverting ? convertedCustomerId : undefined,
        convertedAt: isConverting ? new Date() : undefined
      }
    });
  });

  await writeAuditLogSafe({
    userId: admin.userId,
    action: "UPDATE",
    entity: "Lead",
    entityId: id,
    metadata: convertedCustomerId ? { convertedCustomerId } : undefined
  });
  return NextResponse.json({ data: serializeLead(lead) });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  await prisma.lead.delete({ where: { id } });
  await writeAuditLogSafe({ userId: admin.userId, action: "DELETE", entity: "Lead", entityId: id });
  return NextResponse.json({ data: { id } });
}
