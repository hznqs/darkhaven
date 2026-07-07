import { NextResponse, type NextRequest } from "next/server";
import { buildSaleWhere, getSalesSummary } from "@/lib/server/sales";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const where = buildSaleWhere(request.nextUrl.searchParams);
  const data = await getSalesSummary(where, request.nextUrl.searchParams);
  return NextResponse.json({ data });
}
