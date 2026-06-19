import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { writeAuditLogSafe } from "@/lib/server/audit";
import { requireAdmin, requireAuth } from "@/lib/server/security";
import { serializeCustomer } from "@/lib/server/serializers";
import { customerSchema } from "@/lib/server/validators";
import { readWithRetry } from "@/lib/server/read-retry";
import { parseJsonBody, safeErrorResponse, warnInDevelopment } from "@/lib/server/errors";
import { getPaidTotalsByCustomerIds } from "@/lib/server/customers";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const search = request.nextUrl.searchParams.get("search")?.trim();
  const where: Prisma.CustomerWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { whatsapp: { contains: search } },
          { email: { contains: search, mode: "insensitive" } }
        ]
      }
    : {};

  const customers = await readWithRetry(() =>
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" }
    })
  );
  const paidTotals = await getPaidTotalsByCustomerIds(customers.map((customer) => customer.id));

  return NextResponse.json({
    data: customers.map((customer) => serializeCustomer({ ...customer, totalSpent: paidTotals.get(customer.id) ?? 0 }))
  });
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin.ok) return NextResponse.json({ error: admin.message }, { status: admin.status });

  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = customerSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const exists = await prisma.customer.findUnique({ where: { whatsapp: parsed.data.whatsapp }, select: { id: true } });
    if (exists) return NextResponse.json({ error: "Já existe cliente com este WhatsApp." }, { status: 409 });

    const customer = await prisma.customer.create({
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

    await writeAuditLogSafe({
      userId: admin.userId,
      action: "CREATE",
      entity: "Customer",
      entityId: customer.id,
      metadata: { whatsapp: customer.whatsapp }
    });

    return NextResponse.json({ data: serializeCustomer(customer) }, { status: 201 });
  } catch (error) {
    warnInDevelopment("Customer creation failed", error);
    return safeErrorResponse("Não foi possível criar o cliente.");
  }
}
