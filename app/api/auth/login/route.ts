import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { loginSchema } from "@/lib/server/validators";
import { safeErrorResponse, warnInDevelopment, parseJsonBody } from "@/lib/server/errors";
import { sanitizeUser, sessionCookieName, signSession } from "@/lib/server/security";

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; nextAt: number }>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

function registerFailedAttempt(key: string) {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || record.nextAt < now) {
    loginAttempts.set(key, { count: 1, nextAt: now + LOGIN_WINDOW_MS });
    return;
  }
  record.count += 1;
  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.nextAt = now + LOGIN_WINDOW_MS;
  }
}

function isLocked(key: string) {
  const record = loginAttempts.get(key);
  if (!record) return false;
  return record.count >= MAX_LOGIN_ATTEMPTS && record.nextAt > Date.now();
}

function clearAttempts(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest) {
  const body = await parseJsonBody(request);
  if (!body.ok) return body.response;

  const parsed = loginSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: "Informe e-mail e senha válidos." }, { status: 422 });

  const ip = getClientIp(request);
  const rateKey = `${ip}:${parsed.data.email.toLowerCase()}`;
  if (isLocked(rateKey)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429 }
    );
  }

  let dummyHash: string | null = null;

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
      if (!dummyHash) dummyHash = await bcrypt.hash("__no_user__", 10).catch(() => null);
      if (dummyHash) await bcrypt.compare(parsed.data.password, dummyHash).catch(() => false);
      registerFailedAttempt(rateKey);
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      registerFailedAttempt(rateKey);
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
    response.cookies.set(sessionCookieName, signSession(safeUser, maxAge), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge
    });
    clearAttempts(rateKey);
    return response;
  } catch (error) {
    warnInDevelopment("Login failed", error);
    return safeErrorResponse("Não foi possível autenticar agora.");
  }
}
