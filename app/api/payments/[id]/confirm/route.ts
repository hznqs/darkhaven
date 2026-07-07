import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/security";
import { serializePayment } from "@/lib/server/serializers";
import { safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const confirmation = await tx.payment.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "CONFIRMED", paidAt: new Date() }
      });

      if (confirmation.count !== 1) {
        const currentPayment = await tx.payment.findUnique({
          where: { id },
          select: { status: true }
        });

        if (!currentPayment) throw new Error("PAYMENT_NOT_FOUND");
        if (currentPayment.status === "CONFIRMED") throw new Error("PAYMENT_ALREADY_CONFIRMED");
        if (currentPayment.status === "REFUNDED" || currentPayment.status === "CANCELED") throw new Error("PAYMENT_CLOSED");
        throw new Error("PAYMENT_NOT_PENDING");
      }

      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          sale: {
            include: {
              customer: true,
              items: true,
              orders: true
            }
          }
        }
      });

      if (!payment) throw new Error("PAYMENT_NOT_FOUND");

      await tx.sale.update({
        where: { id: payment.saleId },
        data: { status: "CONFIRMED" }
      });

      if (payment.sale.orders.length === 0) {
        await tx.order.create({
          data: {
            saleId: payment.saleId,
            customerId: payment.sale.customerId,
            status: "PAID",
            total: payment.sale.total,
            items: {
              create: payment.sale.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPriceSnapshot
              }))
            }
          }
        });
      }

      return payment;
    });

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "PAYMENT_CONFIRMATION",
      entity: "Payment",
      entityId: id,
      metadata: { saleId: result.sale.id }
    });

    return NextResponse.json({ data: serializePayment(result) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
      }
      if (error.message === "PAYMENT_CLOSED") {
        return NextResponse.json({ error: "Pagamento encerrado não pode ser confirmado." }, { status: 409 });
      }
      if (error.message === "PAYMENT_ALREADY_CONFIRMED") {
        return NextResponse.json({ error: "Pagamento já confirmado." }, { status: 409 });
      }
      if (error.message === "PAYMENT_NOT_PENDING") {
        return NextResponse.json({ error: "Pagamento precisa estar pendente para ser confirmado." }, { status: 409 });
      }
    }

    warnInDevelopment("Payment confirmation failed", error);
    return safeErrorResponse("Não foi possível confirmar o pagamento.");
  }
}
