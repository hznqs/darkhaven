import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { loginSchema } from "@/lib/server/validators";
import { safeErrorResponse, warnInDevelopment, parseJsonBody } from "@/lib/server/errors";
import { sanitizeUser, sessionCookieName, signSession } from "@/lib/server/security";

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = loginSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Informe e-mail e senha válidos." }, { status: 422 });

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        isOwnerAdmin: true,
        passwordHash: true,
        lastLoginAt: true,
        createdAt: true
      }
    });
    if (!user || !user.active) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        isOwnerAdmin: true,
        lastLoginAt: true,
        createdAt: true
      }
    });
    const safeUser = sanitizeUser(updated);
    const remember = Boolean((body.data as Record<string, unknown>).remember);
    const maxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8; // 30 dias ou 8h
    const response = NextResponse.json({ data: safeUser });
    response.cookies.set(sessionCookieName, signSession(safeUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge
    });
    return response;
  } catch (error) {
    warnInDevelopment("Login failed", error);
    return safeErrorResponse("Não foi possível autenticar agora.");
  }
}
