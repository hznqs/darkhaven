import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializeCustomer } from "@/lib/server/serializers";
import { customerSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody } from "@/lib/server/errors";
import { validPurchaseHistoryWhere } from "@/lib/server/purchase-history";
import { getPaidTotalByCustomerId } from "@/lib/server/customers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { id } = await context.params;
  const customer = await readWithRetry(() =>
    prisma.customer.findUnique({
      where: { id },
      include: {
        purchaseHistory: {
          where: validPurchaseHistoryWhere(),
          orderBy: { purchasedAt: "desc" },
          take: 10,
          include: {
            sale: { select: { saleNumber: true } }
          }
        },
        sales: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            items: { include: { product: { select: { name: true } } } }
          }
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 20
        },
        postSales: {
          orderBy: { createdAt: "desc" },
          take: 20
        }
      }
    })
  );
  if (!customer) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  const paidTotal = await getPaidTotalByCustomerId(id);
  return NextResponse.json({ data: serializeCustomer({ ...customer, totalSpent: paidTotal }) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = customerSchema.partial().safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  if (parsed.data.whatsapp) {
    const duplicate = await prisma.customer.findFirst({
      where: { whatsapp: parsed.data.whatsapp, id: { not: id } },
      select: { id: true }
    });
    if (duplicate) return NextResponse.json({ error: "Já existe cliente com este WhatsApp." }, { status: 409 });
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...parsed.data,
      email: parsed.data.email || undefined,
      instagram: parsed.data.instagram || undefined,
      address: parsed.data.address || undefined,
      city: parsed.data.city || undefined,
      state: parsed.data.state || undefined,
      notes: parsed.data.notes || undefined
    }
  });

  await writeAuditLogSafe({ userId: admin.userId, action: "UPDATE", entity: "Customer", entityId: id });
  const paidTotal = await getPaidTotalByCustomerId(id);
  return NextResponse.json({ data: serializeCustomer({ ...customer, totalSpent: paidTotal }) });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const { id } = await context.params;
  const existing = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const customer = await prisma.customer.update({ where: { id }, data: { status: "inactive" } });
  await writeAuditLogSafe({ userId: admin.userId, action: "UPDATE", entity: "Customer", entityId: id, metadata: { softDelete: true } });
  const paidTotal = await getPaidTotalByCustomerId(id);
  return NextResponse.json({ data: serializeCustomer({ ...customer, totalSpent: paidTotal }) });
}
