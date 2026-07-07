import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/security";
import { serializePayment } from "@/lib/server/serializers";
import { reasonSchema } from "@/lib/server/validators";
import { parseJsonBody, safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = reasonSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { id } = await context.params;
  try {
    const payment = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({
        where: { id },
        select: { status: true, saleId: true }
      });

      if (!current) throw new Error("PAYMENT_NOT_FOUND");
      if (current.status !== "CONFIRMED") throw new Error("PAYMENT_NOT_CONFIRMED");

      const updated = await tx.payment.update({
        where: { id },
        data: { status: "REFUNDED", reason: parsed.data.reason },
        include: { sale: { include: { customer: true } } }
      });

      await tx.sale.update({
        where: { id: current.saleId },
        data: { status: "CANCELED" }
      });

      await tx.order.updateMany({
        where: { saleId: current.saleId, status: { not: "CANCELED" } },
        data: { status: "CANCELED" }
      });

      return updated;
    });

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "REFUND_REQUEST",
      entity: "Payment",
      entityId: id,
      metadata: { reason: parsed.data.reason }
    });

    return NextResponse.json({ data: serializePayment(payment) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
      if (error.message === "PAYMENT_NOT_CONFIRMED") return NextResponse.json({ error: "Apenas pagamentos confirmados podem ser estornados." }, { status: 409 });
    }

    warnInDevelopment("Payment refund failed", error);
    return safeErrorResponse("Não foi possível estornar o pagamento.");
  }
}
