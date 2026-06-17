import { NextResponse, type NextRequest } from "next/server";
import { getDashboardData } from "@/lib/server/analytics";
import { requireAuth } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const data = await getDashboardData();
  return NextResponse.json({ data: data.revenueByChannel });
}
