import { NextResponse, type NextRequest } from "next/server";
import type { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializePayment } from "@/lib/server/serializers";
import { paymentSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody, safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";

const paymentStatuses = new Set(["PENDING", "CONFIRMED", "REFUNDED", "CANCELED"]);
const paymentMethods = new Set(["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO", "CASH"]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const searchParams = request.nextUrl.searchParams;
  const where: Prisma.PaymentWhereInput = {};
  const status = searchParams.get("status");
  const method = searchParams.get("method");
  const search = searchParams.get("search")?.trim();

  if (status && paymentStatuses.has(status)) where.status = status as PaymentStatus;
  if (method && paymentMethods.has(method)) where.method = method as PaymentMethod;
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { sale: { id: { contains: search, mode: "insensitive" } } },
      { sale: { customer: { name: { contains: search, mode: "insensitive" } } } }
    ];
  }

  const payments = await readWithRetry(() =>
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        sale: {
          include: { customer: true }
        }
      }
    })
  );

  return NextResponse.json({ data: payments.map(serializePayment) });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = paymentSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: parsed.data.saleId },
        select: {
          id: true,
          total: true,
          status: true,
          payments: {
            where: { status: { in: ["PENDING", "CONFIRMED"] } },
            select: { id: true, status: true }
          }
        }
      });

      if (!sale) throw new Error("SALE_NOT_FOUND");
      if (sale.status === "CANCELED") throw new Error("SALE_CANCELED");
      if (sale.payments.length > 0) throw new Error("PAYMENT_EXISTS");

      return tx.payment.create({
        data: {
          saleId: parsed.data.saleId,
          method: parsed.data.method,
          amount: sale.total,
          status: "PENDING"
        },
        include: { sale: { include: { customer: true } } }
      });
    });

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "CREATE",
      entity: "Payment",
      entityId: payment.id,
      metadata: { saleId: payment.saleId, amount: Number(payment.amount) }
    });

    return NextResponse.json({ data: serializePayment(payment) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SALE_NOT_FOUND") {
      return NextResponse.json({ error: "Venda informada não existe." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SALE_CANCELED") {
      return NextResponse.json({ error: "Venda cancelada não pode receber pagamento." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PAYMENT_EXISTS") {
      return NextResponse.json({ error: "Esta venda já possui pagamento pendente ou confirmado." }, { status: 409 });
    }

    warnInDevelopment("Payment creation failed", error);
    return safeErrorResponse("Não foi possível criar o pagamento.");
  }
}
