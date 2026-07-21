import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import type { AppUser } from "@/lib/types";
import { prisma } from "@/lib/server/prisma";
import { readWithRetry } from "@/lib/server/read-retry";

export const sessionCookieName = "darkhaven_session";

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AppUser["role"];
  isOwnerAdmin: boolean;
  iat: number;
  exp: number;
};

export type AuthResult =
  | { ok: true; user: AppUser; userId: string }
  | { ok: false; status: number; message: string };

export function signSession(
  user: Pick<AppUser, "id" | "email" | "name" | "role" | "isOwnerAdmin">,
  ttlSeconds = 60 * 60 * 8
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isOwnerAdmin: user.isOwnerAdmin,
    iat: now,
    exp: now + ttlSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const token = request.cookies.get(sessionCookieName)?.value;
  const payload = token ? verifySession(token) : null;
  if (!payload) {
    return { ok: false, status: 401, message: "Autenticação obrigatória." };
  }

  try {
    const fresh = await readWithRetry(() =>
      prisma.user.findUnique({
        where: { id: payload.sub },
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
      })
    );

    if (!fresh || !fresh.active) {
      return { ok: false, status: 401, message: "Sessão expirada ou usuário desativado." };
    }

    if (fresh.lastLoginAt && payload.iat && fresh.lastLoginAt.getTime() > (payload.iat + 1) * 1000) {
      return { ok: false, status: 401, message: "Sessão invalidada. Faça login novamente." };
    }

    if (fresh.role !== payload.role || fresh.isOwnerAdmin !== payload.isOwnerAdmin) {
      return { ok: false, status: 401, message: "Sessão desatualizada. Faça login novamente." };
    }

    return {
      ok: true,
      userId: fresh.id,
      user: {
        id: fresh.id,
        email: fresh.email,
        name: fresh.name,
        role: fresh.role,
        active: fresh.active,
        isOwnerAdmin: fresh.isOwnerAdmin,
        createdAt: fresh.createdAt.toISOString()
      }
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("requireAuth DB revalidation:", error instanceof Error ? error.message : error);
    }
    return {
      ok: true,
      userId: payload.sub,
      user: {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        active: true,
        isOwnerAdmin: payload.isOwnerAdmin,
        createdAt: new Date(0).toISOString()
      }
    };
  }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;
  if (auth.user.role !== "ADMIN") {
    return { ok: false, status: 403, message: "Usuário ADMIN autenticado é obrigatório para esta ação." };
  }
  return auth;
}

export async function requireOwnerAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth;
  if (!auth.user.isOwnerAdmin) {
    return { ok: false, status: 403, message: "Apenas o admin principal pode executar esta ação." };
  }
  return auth;
}

export function requireCron(request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    return { ok: true };
  }

  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return { ok: false, status: 401, message: "Unauthorized cron request." };
  }
  return { ok: true };
}

export function sanitizeUser(user: {
  id: string;
  name: string;
  email: string;
  role: AppUser["role"];
  active: boolean;
  isOwnerAdmin: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
}): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    isOwnerAdmin: user.isOwnerAdmin,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString()
  };
}

export function hasValidSessionToken(token?: string) {
  return token ? verifySession(token) !== null : false;
}

function verifySession(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = sign(`${encodedHeader}.${encodedPayload}`);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sign(value: string) {
  return crypto.createHmac("sha256", getJwtSecret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET precisa estar configurado com pelo menos 32 caracteres.");
  }
  return secret;
}
