import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const orders = await readWithRetry(() =>
    prisma.order.groupBy({
      by: ["status"],
      _count: { id: true }
    })
  );

  return NextResponse.json({ data: orders.map((order) => ({ status: order.status, count: order._count.id })) });
}
