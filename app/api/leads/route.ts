import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializeLead } from "@/lib/server/serializers";
import { leadSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody } from "@/lib/server/errors";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const leads = await readWithRetry(() =>
    prisma.lead.findMany({
      where: {
        convertedAt: null,
        status: { not: "CLOSED_WON" }
      },
      orderBy: { createdAt: "desc" }
    })
  );
  return NextResponse.json({ data: leads.map(serializeLead) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = leadSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const shouldConvert = parsed.data.status === "CLOSED_WON";
  const customer = await prisma.customer.findUnique({ where: { whatsapp: parsed.data.whatsapp }, select: { id: true } });
  if (customer && !shouldConvert) return NextResponse.json({ error: "Já existe cliente com este WhatsApp. Não duplicar lead." }, { status: 409 });

  let convertedCustomerId: string | undefined;
  const lead = await prisma.$transaction(async (tx) => {
    if (shouldConvert) {
      const convertedCustomer = await tx.customer.upsert({
        where: { whatsapp: parsed.data.whatsapp },
        update: {},
        create: {
          name: parsed.data.name,
          whatsapp: parsed.data.whatsapp,
          status: "active",
          tags: ["Lead convertido"]
        },
        select: { id: true }
      });
      convertedCustomerId = convertedCustomer.id;
    }

    return tx.lead.create({
      data: {
        ...parsed.data,
        convertedCustomerId: shouldConvert ? convertedCustomerId : undefined,
        convertedAt: shouldConvert ? new Date() : undefined
      }
    });
  });
  await writeAuditLogSafe({
    userId: admin.userId,
    action: "CREATE",
    entity: "Lead",
    entityId: lead.id,
    metadata: convertedCustomerId ? { convertedCustomerId } : undefined
  });
  return NextResponse.json({ data: serializeLead(lead) }, { status: 201 });
}
