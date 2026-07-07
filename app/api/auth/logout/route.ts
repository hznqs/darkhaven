import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireAuth, sessionCookieName } from "@/lib/server/security";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);

  if (auth.ok) {
    try {
      await prisma.user.update({
        where: { id: auth.userId },
        data: { lastLoginAt: new Date() }
      });
    } catch {
      // silence — cookie removal still essential
    }
  }

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
