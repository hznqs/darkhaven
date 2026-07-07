import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { groupRevenueByDay } from "@/lib/server/analytics";
import { readWithRetry } from "@/lib/server/read-retry";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const customers = await readWithRetry(() => prisma.customer.findMany({ select: { createdAt: true } }));
  return NextResponse.json({ data: groupRevenueByDay(customers.map((customer) => ({ date: customer.createdAt, value: 1 }))) });
}
