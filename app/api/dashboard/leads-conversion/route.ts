import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const [won, total] = await readWithRetry(() =>
    Promise.all([
      prisma.lead.count({ where: { status: "CLOSED_WON" } }),
      prisma.lead.count()
    ])
  );

  return NextResponse.json({ data: { total, won, rate: total ? (won / total) * 100 : 0 } });
}
