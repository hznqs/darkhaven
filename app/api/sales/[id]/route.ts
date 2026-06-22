import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializeSaleDetail } from "@/lib/server/sales";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody } from "@/lib/server/errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await context.params;
  const sale = await readWithRetry(() =>
    prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
        payments: { orderBy: { createdAt: "desc" } },
        orders: { orderBy: { createdAt: "desc" } },
        postSales: true
      }
    })
  );

  if (!sale) return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
  return NextResponse.json({ data: serializeSaleDetail(sale) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const body = await parseJsonBody<{ action?: string; reason?: string }>(request);
  if (!body.ok) return body.response;

  if (body.data.action !== "cancel") return NextResponse.json({ error: "Ação não suportada." }, { status: 422 });

  try {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { payments: true }
    });
    if (!sale) return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
    if (sale.status === "CANCELED") return NextResponse.json({ error: "Venda já cancelada." }, { status: 409 });
    if (sale.payments.some((payment) => payment.status === "CONFIRMED")) {
      return NextResponse.json({ error: "Venda paga deve ser estornada, não cancelada." }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.sale.update({
        where: { id },
        data: {
          status: "CANCELED",
          payments: {
            updateMany: {
              where: { status: "PENDING" },
              data: { status: "CANCELED", reason: body.data.reason?.slice(0, 300) ?? "Venda cancelada." }
            }
          }
        },
        include: {
          customer: true,
          items: { include: { product: true } },
          payments: { orderBy: { createdAt: "desc" } },
          orders: { orderBy: { createdAt: "desc" } },
          postSales: true
        }
      });
      return result;
    });

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "UPDATE",
      entity: "Sale",
      entityId: id,
      metadata: { canceled: true, reason: body.data.reason?.slice(0, 300) }
    });

    return NextResponse.json({ data: serializeSaleDetail(updated) });
  } catch (error) {
    return NextResponse.json({ error: "Não foi possível cancelar a venda." }, { status: 500 });
  }
}
