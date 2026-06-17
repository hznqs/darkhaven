import { NextResponse, type NextRequest } from "next/server";
import { getFinanceData } from "@/lib/server/analytics";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const data = await getFinanceData();
  return NextResponse.json({ data: data.revenue });
}
