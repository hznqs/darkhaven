import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/security";
import { serializeOrder } from "@/lib/server/serializers";
import { allowedOrderTransitions, orderStatusSchema } from "@/lib/server/validators";
import { parseJsonBody } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.message }, { status: admin.status });
  }

  const { id } = await context.params;
  const currentOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!currentOrder) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = orderStatusSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const allowed = allowedOrderTransitions[currentOrder.status].includes(parsed.data.status);
  const sameStatus = currentOrder.status === parsed.data.status;

  if (!allowed && !sameStatus) {
    return NextResponse.json(
      {
        error: "Transição de status não permitida.",
        from: currentOrder.status,
        to: parsed.data.status
      },
      { status: 409 }
    );
  }

  await writeAuditLogSafe({
    userId: admin.userId,
    action: "STATUS_CHANGE",
    entity: "Order",
    entityId: id,
    metadata: {
      from: currentOrder.status,
      to: parsed.data.status
    }
  });

  const updatedOrder = await prisma.order.update({
    where: { id },
    data: {
      status: parsed.data.status
    },
    include: {
      customer: true,
      sale: true,
      items: {
        include: { product: true }
      }
    }
  });

  return NextResponse.json({
    data: serializeOrder(updatedOrder)
  });
}
