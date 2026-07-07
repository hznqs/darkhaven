import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializePostSale } from "@/lib/server/serializers";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/security";
import { postSaleSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody } from "@/lib/server/errors";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.message }, { status: admin.status });
  }

  const data = await readWithRetry(() =>
    prisma.postSale.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        order: true,
        sale: true,
        responsibleUser: {
          select: { id: true, name: true, email: true }
        },
        history: {
          orderBy: { createdAt: "desc" }
        }
      }
    })
  );

  return NextResponse.json({ data: data.map(serializePostSale) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.message }, { status: admin.status });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) {
    return body.response;
  }

  const parsed = postSaleSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const [customer, order, sale, responsibleUser] = await Promise.all([
    prisma.customer.findUnique({ where: { id: parsed.data.customerId }, select: { id: true } }),
    parsed.data.orderId
      ? prisma.order.findUnique({ where: { id: parsed.data.orderId }, select: { id: true, customerId: true } })
      : Promise.resolve(null),
    parsed.data.saleId
      ? prisma.sale.findUnique({ where: { id: parsed.data.saleId }, select: { id: true, customerId: true } })
      : Promise.resolve(null),
    parsed.data.responsibleUserId
      ? prisma.user.findUnique({ where: { id: parsed.data.responsibleUserId }, select: { id: true } })
      : Promise.resolve(null)
  ]);

  if (!customer) {
    return NextResponse.json({ error: "Cliente informado não existe." }, { status: 404 });
  }

  if (parsed.data.orderId && !order) {
    return NextResponse.json({ error: "Pedido informado não existe." }, { status: 404 });
  }

  if (parsed.data.saleId && !sale) {
    return NextResponse.json({ error: "Venda informada não existe." }, { status: 404 });
  }

  if (sale && sale.customerId !== parsed.data.customerId) {
    return NextResponse.json({ error: "A venda informada não pertence ao cliente selecionado." }, { status: 422 });
  }

  if (order && order.customerId !== parsed.data.customerId) {
    return NextResponse.json({ error: "O pedido informado não pertence ao cliente selecionado." }, { status: 422 });
  }

  if (parsed.data.responsibleUserId && !responsibleUser) {
    return NextResponse.json({ error: "Responsável informado não existe." }, { status: 404 });
  }

  const record = await prisma.postSale.create({
    data: {
      customerId: parsed.data.customerId,
      orderId: parsed.data.orderId,
      saleId: parsed.data.saleId,
      type: parsed.data.type,
      status: parsed.data.status,
      priority: parsed.data.priority,
      notes: parsed.data.notes,
      customerFeedback: parsed.data.customerFeedback,
      resolution: parsed.data.resolution,
      responsibleUserId: parsed.data.responsibleUserId,
      nextActionAt: parsed.data.nextActionAt ? new Date(`${parsed.data.nextActionAt}T12:00:00.000`) : undefined,
      resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : undefined,
      refundRequested: parsed.data.refundRequested,
      refundReason: parsed.data.refundReason,
      history: {
        create: {
          message: "Atendimento de pós-venda criado."
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
    action: "CREATE",
    entity: "PostSale",
    entityId: record.id,
    metadata: {
      type: parsed.data.type,
      status: parsed.data.status,
      priority: parsed.data.priority
    }
  });

  if (parsed.data.refundRequested) {
    await writeAuditLogSafe({
      userId: admin.userId,
      action: "REFUND_REQUEST",
      entity: "PostSale",
      entityId: record.id,
      metadata: {
        saleId: parsed.data.saleId,
        reason: parsed.data.refundReason
      }
    });
  }

  return NextResponse.json({ data: serializePostSale(record) }, { status: 201 });
}
