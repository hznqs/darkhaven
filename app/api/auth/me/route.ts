import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, sanitizeUser } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  return NextResponse.json({ data: sanitizeUser(user) });
}
