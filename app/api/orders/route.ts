import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { serializeOrder } from "@/lib/server/serializers";
import { readWithRetry } from "@/lib/server/read-retry";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const orders = await readWithRetry(() =>
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        customer: true,
        sale: true,
        items: {
          include: { product: true }
        }
      }
    })
  );

  return NextResponse.json({ data: orders.map(serializeOrder) });
}
