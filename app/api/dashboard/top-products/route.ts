import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const items = await readWithRetry(() =>
    prisma.saleItem.groupBy({
      by: ["productNameSnapshot"],
      _sum: { quantity: true, subtotal: true, discount: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 8
    })
  );

  return NextResponse.json({
    data: items.map((item) => ({
      name: item.productNameSnapshot,
      quantity: item._sum.quantity ?? 0,
      revenue: Number(item._sum.subtotal ?? 0) - Number(item._sum.discount ?? 0)
    }))
  });
}
